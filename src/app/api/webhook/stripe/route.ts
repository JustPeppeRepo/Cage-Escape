import Stripe from "stripe";
import { after, NextResponse } from "next/server";
import {
  BookingStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/app/_lib/stripe";
import { env } from "@/app/_lib/env";
import { isSlotAvailable } from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { getBookingChargeAmount } from "@/app/_lib/bookings/charge-amount";
import {
  decimalToStripeCents,
  stripeCentsToEuroFixed,
} from "@/app/_lib/bookings/money";
import { sendStripeOpsAlert } from "@/app/_lib/stripe/ops-alert";

export const runtime = "nodejs";

type TransactionClient = Prisma.TransactionClient;

type StripeOpsAlertPayload = {
  subject: string;
  details: Record<string, unknown>;
};

function queueStripeOpsAlert(
  alerts: StripeOpsAlertPayload[],
  subject: string,
  details: Record<string, unknown>,
): void {
  alerts.push({ subject, details });
}

function scheduleStripeOpsAlerts(alerts: StripeOpsAlertPayload[]): void {
  if (alerts.length === 0) {
    return;
  }

  // Non attendere Resend prima del 200: Stripe ritenta se l'endpoint
  // supera ~5s. Gli alert sono best-effort (gia' loggati se falliscono).
  after(async () => {
    await Promise.all(alerts.map((alert) => sendStripeOpsAlert(alert)));
  });
}

function paidCentsFromSession(checkoutSession: Stripe.Checkout.Session): number {
  return checkoutSession.amount_total ?? 0;
}

// Stripe ha gia' incassato il pagamento in TUTTI i rami che portano a
// PAYMENT_CONFLICT_REFUND_REQUIRED: senza una riga Payment tracciata qui,
// l'unica traccia del denaro incassato resta l'email di alert, e sia il
// cancel admin che l'eventuale rimborso self-service dell'utente non
// troverebbero nulla da rimborsare (booking.payments.length === 0). Questo
// helper e' idempotente rispetto a consegne duplicate dello stesso webhook
// (P2002 su stripePaymentId = pagamento gia' registrato da una consegna
// precedente, non un errore).
async function recordConflictPayment(
  tx: TransactionClient,
  params: {
    bookingId: string;
    paymentIntentId: string;
    amountCents: number;
    type: PaymentType;
  },
): Promise<void> {
  try {
    await tx.payment.create({
      data: {
        bookingId: params.bookingId,
        stripePaymentId: params.paymentIntentId,
        amount: new Prisma.Decimal(stripeCentsToEuroFixed(params.amountCents)),
        type: params.type,
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

// ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_IDEMPOTENCY]: WRITE-FIRST pattern enforcement
// This function implements the WRITE-FIRST idempotency pattern where we attempt
// to insert the event.id into StripeWebhookEvent BEFORE processing any business logic.
// Concurrent requests are immediately blocked by DB Unique Constraint Violation (P2002).
// This prevents race conditions and ensures exactly-once processing of webhook events.
async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<"claimed" | "duplicate"> {
  try {
    // ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_IDEMPOTENCY]: ATOMIC WRITE-FIRST CLAIM
    // This CREATE operation MUST happen BEFORE any business logic processing.
    // The unique constraint on StripeWebhookEvent.id ensures only one concurrent
    // request can claim an event ID, all others receive P2002 and return "duplicate".
    await prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });
    return "claimed";
  } catch (error) {
    // ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_IDEMPOTENCY]: P2002 duplicate detection
    // Prisma error P2002 indicates unique constraint violation on event.id
    // This is the expected mechanism for detecting duplicate webhook deliveries
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate";
    }
    throw error;
  }
}

async function releaseWebhookEventClaim(eventId: string): Promise<void> {
  // Solo su failure dell'handler: cosi' Stripe puo' ritentare lo stesso
  // event.id. In caso di successo il claim resta (idempotenza).
  await prisma.stripeWebhookEvent.deleteMany({ where: { id: eventId } });
}

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session,
): Promise<StripeOpsAlertPayload[]> {
  const bookingId = checkoutSession.metadata?.bookingId;
  const paymentChoiceRaw = checkoutSession.metadata?.paymentChoice;

  if (!bookingId || !paymentChoiceRaw) {
    console.error(
      "[stripe webhook] checkout.session.completed missing metadata",
      checkoutSession.id,
    );
    throw new Error("Missing checkout session metadata");
  }

  // Difesa in profondita: con soli "card" tra i payment_method_types
  // l'evento completed arriva sempre gia pagato, ma controlliamo comunque
  // esplicitamente per non fidarci implicitamente del tipo di evento nel
  // caso in futuro vengano abilitati metodi di pagamento asincroni.
  if (checkoutSession.payment_status !== "paid") {
    console.warn(
      "[stripe webhook] checkout.session.completed con payment_status non 'paid', ignorato:",
      JSON.stringify({
        sessionId: checkoutSession.id,
        paymentStatus: checkoutSession.payment_status,
      }),
    );
    return [];
  }

  if (
    paymentChoiceRaw !== PaymentType.FULL &&
    paymentChoiceRaw !== PaymentType.DEPOSIT
  ) {
    console.error(
      "[stripe webhook] Invalid paymentChoice metadata",
      paymentChoiceRaw,
    );
    throw new Error("Invalid paymentChoice metadata");
  }

  const paymentChoice = paymentChoiceRaw;

  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;

  if (!paymentIntentId) {
    console.error(
      "[stripe webhook] Missing payment_intent on completed session",
      checkoutSession.id,
    );
    throw new Error("Missing payment_intent on checkout session");
  }

  const nextStatus =
    paymentChoice === PaymentType.FULL
      ? BookingStatus.PAID
      : BookingStatus.DEPOSIT_PAID;

  const opsAlerts: StripeOpsAlertPayload[] = [];

  await prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          room: { include: { pricingTiers: true } },
          payments: true,
          discountCode: true,
        },
      });

      if (!booking) {
        console.error("[stripe webhook] Booking not found", bookingId);
        throw new Error("Booking not found");
      }

      const existingPayment = booking.payments.find(
        (payment) => payment.stripePaymentId === paymentIntentId,
      );
      if (existingPayment) {
        // Stessa consegna webhook rielaborata (retry di Stripe): stesso
        // payment_intent gia registrato, nessuna azione ulteriore.
        return;
      }

      if (
        booking.status === BookingStatus.PAID ||
        booking.status === BookingStatus.DEPOSIT_PAID
      ) {
        // Un payment_intent DIVERSO arriva su un booking gia confermato da
        // un pagamento precedente (doppio click, doppia tab, doppia
        // sessione Stripe pagata): senza questo ramo il secondo addebito
        // spariva silenziosamente, incassato da Stripe ma senza alcuna
        // traccia nel nostro DB per un rimborso. Non tocchiamo lo stato
        // della prenotazione (gia corretto), registriamo solo il pagamento
        // duplicato per il rimborso manuale.
        const duplicatePaidCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] PAGAMENTO DUPLICATO su booking gia confermato - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            existingStatus: booking.status,
            duplicatePaidCents,
          }),
        );
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            stripePaymentId: paymentIntentId,
            amount: new Prisma.Decimal(stripeCentsToEuroFixed(duplicatePaidCents)),
            type: paymentChoice,
            status: PaymentStatus.SUCCEEDED,
            paidAt: new Date(),
          },
        });
        queueStripeOpsAlert(opsAlerts, "Pagamento duplicato su booking confermato", {
          bookingId: booking.id,
          paymentIntentId,
          existingStatus: booking.status,
          duplicatePaidCents,
        });
        return;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        // L'utente (o l'admin) ha annullato la prenotazione, ma il link di
        // pagamento Stripe era rimasto aperto (es. altra tab) e viene
        // completato comunque. Senza questo guard il codice sotto
        // proseguirebbe verso la conferma normale, "resuscitando" una
        // prenotazione annullata. Il denaro e' comunque stato incassato da
        // Stripe: lo registriamo per rimborso manuale invece di ignorarlo.
        const cancelledPaidCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] Pagamento completato su booking gia CANCELLED - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            cancelledPaidCents,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: cancelledPaidCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Pagamento completato su booking annullato", {
          bookingId: booking.id,
          paymentIntentId,
          conflictAmountCents: cancelledPaidCents,
        });
        return;
      }

      // Booking gia' in conflitto: se e' la stessa consegna webhook rielaborata
      // (stesso payment_intent) il controllo su `existingPayment` sopra ha gia'
      // fatto return. Se invece e' un payment_intent DIVERSO (es. un'altra
      // sessione Stripe pagata per lo stesso booking mentre era gia' in
      // conflitto), va comunque tracciato: senza questo il secondo incasso
      // sparirebbe senza alcuna traccia ne' alert.
      if (booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED) {
        const conflictPaidCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] Nuovo pagamento su booking gia in conflitto - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            conflictPaidCents,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: conflictPaidCents,
          type: paymentChoice,
        });
        queueStripeOpsAlert(opsAlerts, "Nuovo pagamento su booking gia in conflitto", {
          bookingId: booking.id,
          paymentIntentId,
          conflictPaidCents,
        });
        return;
      }

      // Difesa in profondita: i metadata della sessione Stripe sono impostati
      // solo server-side in createStripeCheckoutSession, quindi non sono
      // manipolabili da un client. Un disallineamento qui indicherebbe un
      // bug (es. sessione creata manualmente dalla dashboard Stripe, o un
      // refactor futuro che modifica i metadata) piuttosto che un attacco,
      // ma non vogliamo confermare un pagamento sulla base di dati incoerenti.
      const metadataUserId = checkoutSession.metadata?.userId;
      if (
        paymentChoiceRaw !== booking.paymentChoice ||
        (metadataUserId && metadataUserId !== booking.userId)
      ) {
        const metadataConflictCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] Metadata sessione incoerenti con il booking - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            metadataPaymentChoice: paymentChoiceRaw,
            bookingPaymentChoice: booking.paymentChoice,
            metadataUserId,
            bookingUserId: booking.userId,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: metadataConflictCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Metadata Stripe incoerenti", {
          bookingId: booking.id,
          paymentIntentId,
          metadataPaymentChoice: paymentChoiceRaw,
          bookingPaymentChoice: booking.paymentChoice,
          metadataUserId,
          bookingUserId: booking.userId,
          conflictAmountCents: metadataConflictCents,
        });
        return;
      }
      // Il checkout crea sempre sessioni in "eur" (bookings.ts), ma non ci
      // fidiamo implicitamente del tipo di evento: verifichiamo comunque la
      // valuta effettiva della sessione pagata prima di confermare, stesso
      // trattamento del mismatch di importo qui sotto.
      if (checkoutSession.currency !== "eur") {
        const currencyConflictCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] Valuta inattesa - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            currency: checkoutSession.currency,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: currencyConflictCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Valuta Stripe inattesa", {
          bookingId: booking.id,
          paymentIntentId,
          currency: checkoutSession.currency,
          conflictAmountCents: currencyConflictCents,
        });
        return;
      }

      const tier = resolvePricingTier(
        booking.room.pricingTiers,
        booking.participantCount,
      );

      if (!tier) {
        // Dato incoerente (es. fasce di prezzo rimosse/modificate dopo la
        // creazione dell'hold): non possiamo validare in sicurezza l'importo
        // incassato. Il pagamento e gia stato preso da Stripe, quindi
        // segnaliamo per rimborso manuale invece di rischiare un calcolo
        // errato.
        const missingTierPaidCents = paidCentsFromSession(checkoutSession);
        console.error(
          "[stripe webhook] Nessuna fascia di prezzo trovata - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            roomId: booking.roomId,
            participantCount: booking.participantCount,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: missingTierPaidCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Fascia prezzo mancante al webhook", {
          bookingId: booking.id,
          paymentIntentId,
          roomId: booking.roomId,
          participantCount: booking.participantCount,
          conflictAmountCents: missingTierPaidCents,
        });
        return;
      }

      const expectedCents = decimalToStripeCents(
        getBookingChargeAmount(booking, tier),
      );
      const paidCents = paidCentsFromSession(checkoutSession);

      if (paidCents !== expectedCents) {
        // L'importo incassato da Stripe non coincide con quello atteso (es.
        // la fascia di prezzo e cambiata tra la creazione della sessione e
        // la consegna del webhook). Confronto in centesimi interi: niente
        // tolleranza float. Non confermiamo mai un pagamento sulla base di
        // un importo che non sappiamo validare.
        console.error(
          "[stripe webhook] AMOUNT MISMATCH - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId,
            paymentIntentId,
            expectedCents,
            paidCents,
            paymentChoice,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: paidCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Importo Stripe diverso da atteso", {
          bookingId,
          paymentIntentId,
          expectedCents,
          paidCents,
          paymentChoice,
        });
        return;
      }

      // Il fix del checkout impone expires_at Stripe a 30 minuti (minimo
      // consentito dall'API), mentre l'hold interno dura solo 10 minuti.
      // holdExpiresAt e sempre salvato in UTC da Prisma: getTime() confronta
      // correttamente indipendentemente dal fuso orario dell'app (Europe/Rome).
      const isHoldExpired =
        !booking.holdExpiresAt || booking.holdExpiresAt.getTime() < Date.now();

      if (isHoldExpired) {
        const stillFree = await isSlotAvailable(
          booking.roomId,
          booking.startTime,
          booking.endTime,
          tx,
        );

        if (!stillFree) {
          // Un'altra prenotazione ha gia occupato lo slot mentre l'hold di
          // questo booking era scaduto: il pagamento e stato incassato da
          // Stripe ma la stanza non e piu disponibile. Non tocchiamo la
          // prenotazione vincente: segnaliamo questa come da rimborsare.
          console.error(
            "[stripe webhook] PAYMENT CONFLICT - rimborso manuale richiesto:",
            JSON.stringify({
              bookingId: booking.id,
              paymentIntentId,
              roomId: booking.roomId,
              startTime: booking.startTime.toISOString(),
              endTime: booking.endTime.toISOString(),
            }),
          );
          await recordConflictPayment(tx, {
            bookingId: booking.id,
            paymentIntentId,
            amountCents: paidCents,
            type: paymentChoice,
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
              holdExpiresAt: null,
            },
          });
          queueStripeOpsAlert(opsAlerts, "Conflitto slot post-hold scaduto", {
            bookingId: booking.id,
            paymentIntentId,
            roomId: booking.roomId,
            startTime: booking.startTime.toISOString(),
            endTime: booking.endTime.toISOString(),
            conflictAmountCents: paidCents,
          });
          return;
        }
      }

      try {
        if (booking.discountCodeId) {
          const discount = await tx.discountCode.findUnique({
            where: { id: booking.discountCodeId },
          });

          if (discount?.used) {
            const redeemedByOther = await tx.booking.findFirst({
              where: {
                discountCodeId: booking.discountCodeId,
                id: { not: booking.id },
                status: {
                  in: [BookingStatus.PAID, BookingStatus.DEPOSIT_PAID],
                },
              },
              select: { id: true },
            });

            if (redeemedByOther) {
              console.error(
                "[stripe webhook] Codice sconto già utilizzato - rimborso manuale richiesto:",
                JSON.stringify({
                  bookingId: booking.id,
                  paymentIntentId,
                  discountCodeId: booking.discountCodeId,
                  redeemedByBookingId: redeemedByOther.id,
                }),
              );
              await recordConflictPayment(tx, {
                bookingId: booking.id,
                paymentIntentId,
                amountCents: paidCents,
                type: paymentChoice,
              });
              await tx.booking.update({
                where: { id: booking.id },
                data: {
                  status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
                  holdExpiresAt: null,
                },
              });
              queueStripeOpsAlert(opsAlerts, "Codice sconto già utilizzato", {
                bookingId: booking.id,
                paymentIntentId,
                discountCodeId: booking.discountCodeId,
                redeemedByBookingId: redeemedByOther.id,
                conflictAmountCents: paidCents,
              });
              return;
            }
          }
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: nextStatus,
            holdExpiresAt: null,
            stripeSessionId: checkoutSession.id,
          },
        });

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            stripePaymentId: paymentIntentId,
            amount: new Prisma.Decimal(stripeCentsToEuroFixed(expectedCents)),
            type: paymentChoice,
            status: PaymentStatus.SUCCEEDED,
            paidAt: new Date(),
          },
        });

        if (booking.discountCodeId) {
          await tx.discountCode.update({
            where: { id: booking.discountCodeId },
            data: { used: true, usedAt: new Date() },
          });
        }
      } catch (updateError) {
        // Ultima rete di sicurezza: un webhook concorrente ha vinto
        // l'EXCLUDE constraint (booking_no_overlap_per_room) tra il nostro
        // controllo di disponibilita e il nostro update.
        console.error(
          "[stripe webhook] PAYMENT CONFLICT su update finale - rimborso manuale richiesto:",
          JSON.stringify({ bookingId: booking.id, paymentIntentId }),
          updateError,
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amountCents: paidCents,
          type: paymentChoice,
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        queueStripeOpsAlert(opsAlerts, "Conflitto su update finale booking", {
          bookingId: booking.id,
          paymentIntentId,
          conflictAmountCents: paidCents,
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return opsAlerts;
}

async function handleCheckoutExpired(
  checkoutSession: Stripe.Checkout.Session,
): Promise<void> {
  const bookingId = checkoutSession.metadata?.bookingId;

  const booking = bookingId
    ? await prisma.booking.findUnique({ where: { id: bookingId } })
    : await prisma.booking.findFirst({
        where: { stripeSessionId: checkoutSession.id },
      });

  if (!booking) {
    return;
  }

  // updateMany con guard sullo stato invece di un read-then-update: se
  // "checkout.session.completed" per lo stesso booking arriva in
  // concomitanza (evento quasi simultaneo o riordinato), questa write viene
  // ignorata silenziosamente non appena lo stato non e' piu' PENDING, invece
  // di rischiare di annullare un booking appena confermato come pagato.
  await prisma.booking.updateMany({
    where: { id: booking.id, status: BookingStatus.PENDING },
    data: {
      status: BookingStatus.CANCELLED,
      holdExpiresAt: null,
    },
  });
}

/**
 * Rimborsi avviati da Dashboard Stripe / API esterne (non solo cancel app).
 * Totale: marca Payment REFUNDED; se non restano SUCCEEDED, CANCELLED + slot libero.
 * Parziale: non libera lo slot automaticamente — escalation ops.
 */
async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<StripeOpsAlertPayload[]> {
  const opsAlerts: StripeOpsAlertPayload[] = [];

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn(
      "[stripe webhook] charge.refunded senza payment_intent:",
      charge.id,
    );
    return opsAlerts;
  }

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentId: paymentIntentId },
    include: {
      booking: {
        include: {
          payments: true,
        },
      },
    },
  });

  if (!payment) {
    // Rimborso su un PI non tracciato (sessione test, pagamento fuori app).
    return opsAlerts;
  }

  const isFullyRefunded =
    charge.refunded === true || charge.amount_refunded >= charge.amount;

  if (!isFullyRefunded) {
    queueStripeOpsAlert(opsAlerts, "Rimborso parziale Stripe (slot non liberato)", {
      chargeId: charge.id,
      paymentIntentId,
      bookingId: payment.bookingId,
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
      bookingStatus: payment.booking.status,
    });
    return opsAlerts;
  }

  if (payment.status !== PaymentStatus.REFUNDED) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
  }

  const remainingSucceeded = await prisma.payment.count({
    where: {
      bookingId: payment.bookingId,
      status: PaymentStatus.SUCCEEDED,
    },
  });

  if (remainingSucceeded > 0) {
    queueStripeOpsAlert(
      opsAlerts,
      "Rimborso totale di un pagamento ma ne restano altri SUCCEEDED",
      {
        chargeId: charge.id,
        paymentIntentId,
        bookingId: payment.bookingId,
        remainingSucceeded,
      },
    );
    return opsAlerts;
  }

  // Tutti i pagamenti rimborsati: libera lo slot (CANCELLED esce dal
  // vincolo EXCLUDE PENDING/DEPOSIT_PAID/PAID).
  const cancelled = await prisma.booking.updateMany({
    where: {
      id: payment.bookingId,
      status: {
        in: [
          BookingStatus.PAID,
          BookingStatus.DEPOSIT_PAID,
          BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
        ],
      },
    },
    data: {
      status: BookingStatus.CANCELLED,
      holdExpiresAt: null,
    },
  });

  if (cancelled.count === 0) {
    console.info(
      "[stripe webhook] charge.refunded: booking gia non occupante",
      payment.bookingId,
    );
  }

  return opsAlerts;
}

export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");

  // ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_SECURITY]: [Signature verification and idempotency check]
  // Stripe webhook signature verification prevents replay attacks and ensures 
  // webhook events are authentic and unmodified during transmission
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    // ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_SECURITY]: [Signature verification and idempotency check]
    // constructEvent validates the webhook signature using the raw request body
    // This prevents attackers from forging webhook events
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("[stripe webhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ⚠️ CRITICAL SECURITY CHECK [WEBHOOK_SECURITY]: [Signature verification and idempotency check]
  // Atomic event claiming prevents duplicate processing of the same webhook event.
  // If handler fails, we release the claim so Stripe can retry (otherwise event would be lost).
  // Uses StripeWebhookEvent model for idempotency tracking as required.
  const claim = await claimWebhookEvent(event);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let opsAlerts: StripeOpsAlertPayload[] = [];

    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        opsAlerts = await handleCheckoutCompleted(checkoutSession);
        break;
      }
      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(checkoutSession);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        opsAlerts = await handleChargeRefunded(charge);
        break;
      }
      case "payment_intent.payment_failed": {
        // Checkout mode + card: l'utente puo' ritentare nella stessa
        // sessione. NON cancellare il PENDING qui, altrimenti si libera lo
        // slot mentre Stripe Checkout e' ancora aperto. Lo slot torna
        // disponibile via hold TTL (10m) o checkout.session.expired (30m).
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.info(
          "[stripe webhook] payment_intent.payment_failed (no-op, hold/expiry gestiscono lo slot):",
          paymentIntent.id,
        );
        break;
      }
      default:
        break;
    }

    scheduleStripeOpsAlerts(opsAlerts);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe webhook] Handler error:", error);
    try {
      await releaseWebhookEventClaim(event.id);
    } catch (releaseError) {
      console.error(
        "[stripe webhook] Failed to release event claim:",
        releaseError,
      );
    }
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
