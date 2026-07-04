import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  BookingStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { stripe } from "@/app/_lib/stripe";
import { env } from "@/app/_lib/env";
import { isSlotAvailable } from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { getBookingChargeAmountNumber } from "@/app/_lib/bookings/charge-amount";
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
    amount: number;
    type: PaymentType;
  },
): Promise<void> {
  try {
    await tx.payment.create({
      data: {
        bookingId: params.bookingId,
        stripePaymentId: params.paymentIntentId,
        amount: params.amount,
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

async function dispatchStripeOpsAlerts(alerts: StripeOpsAlertPayload[]): Promise<void> {
  await Promise.all(alerts.map((alert) => sendStripeOpsAlert(alert)));
}

function getExpectedAmount(
  booking: {
    paymentChoice: PaymentType;
    discountCode?: { discountPercent: number } | null;
  },
  tier: {
    totalPrice: { toString(): string };
    depositPrice: { toString(): string };
  },
): number {
  return getBookingChargeAmountNumber(booking, tier);
}

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session,
): Promise<void> {
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
      JSON.stringify({ sessionId: checkoutSession.id, paymentStatus: checkoutSession.payment_status }),
    );
    return;
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
        const duplicatePaidAmount = (checkoutSession.amount_total ?? 0) / 100;
        console.error(
          "[stripe webhook] PAGAMENTO DUPLICATO su booking gia confermato - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            existingStatus: booking.status,
            duplicatePaidAmount,
          }),
        );
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            stripePaymentId: paymentIntentId,
            amount: duplicatePaidAmount,
            type: paymentChoice,
            status: PaymentStatus.SUCCEEDED,
            paidAt: new Date(),
          },
        });
        queueStripeOpsAlert(opsAlerts, "Pagamento duplicato su booking confermato", {
          bookingId: booking.id,
          paymentIntentId,
          existingStatus: booking.status,
          duplicatePaidAmount,
        });
        return;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        // L'utente (o l'admin) ha annullato la prenotazione, ma il link di
        // pagamento Stripe era rimasto apert (es. altra tab) e viene
        // completato comunque. Senza questo guard il codice sotto
        // proseguirebbe verso la conferma normale, "resuscitando" una
        // prenotazione annullata. Il denaro e' comunque stato incassato da
        // Stripe: lo registriamo per rimborso manuale invece di ignorarlo.
        const cancelledPaidAmount = (checkoutSession.amount_total ?? 0) / 100;
        console.error(
          "[stripe webhook] Pagamento completato su booking gia CANCELLED - rimborso manuale richiesto:",
          JSON.stringify({ bookingId: booking.id, paymentIntentId, cancelledPaidAmount }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amount: cancelledPaidAmount,
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
          conflictAmount: cancelledPaidAmount,
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
        const conflictPaidAmount = (checkoutSession.amount_total ?? 0) / 100;
        console.error(
          "[stripe webhook] Nuovo pagamento su booking gia in conflitto - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            conflictPaidAmount,
          }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amount: conflictPaidAmount,
          type: paymentChoice,
        });
        queueStripeOpsAlert(opsAlerts, "Nuovo pagamento su booking gia in conflitto", {
          bookingId: booking.id,
          paymentIntentId,
          conflictPaidAmount,
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
        const metadataConflictAmount = (checkoutSession.amount_total ?? 0) / 100;
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
          amount: metadataConflictAmount,
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
          conflictAmount: metadataConflictAmount,
        });
        return;
      }
      // Il checkout crea sempre sessioni in "eur" (bookings.ts), ma non ci
      // fidiamo implicitamente del tipo di evento: verifichiamo comunque la
      // valuta effettiva della sessione pagata prima di confermare, stesso
      // trattamento del mismatch di importo qui sotto.
      if (checkoutSession.currency !== "eur") {
        const currencyConflictAmount = (checkoutSession.amount_total ?? 0) / 100;
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
          amount: currencyConflictAmount,
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
          conflictAmount: currencyConflictAmount,
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
        const missingTierPaidAmount = (checkoutSession.amount_total ?? 0) / 100;
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
          amount: missingTierPaidAmount,
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
          conflictAmount: missingTierPaidAmount,
        });
        return;
      }

      const expectedAmount = getExpectedAmount(booking, tier);
      const paidAmount = (checkoutSession.amount_total ?? 0) / 100;

      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        // L'importo incassato da Stripe non coincide con quello atteso (es.
        // la fascia di prezzo e cambiata tra la creazione della sessione e
        // la consegna del webhook). Non confermiamo mai un pagamento sulla
        // base di un importo che non sappiamo validare: meglio un falso
        // rimborso manuale che una prenotazione confermata a un prezzo errato.
        console.error(
          "[stripe webhook] AMOUNT MISMATCH - rimborso manuale richiesto:",
          JSON.stringify({ bookingId, paymentIntentId, expectedAmount, paidAmount, paymentChoice }),
        );
        await recordConflictPayment(tx, {
          bookingId: booking.id,
          paymentIntentId,
          amount: paidAmount,
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
          expectedAmount,
          paidAmount,
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
            amount: paidAmount,
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
            conflictAmount: paidAmount,
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
                amount: paidAmount,
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
                conflictAmount: paidAmount,
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
            amount: expectedAmount,
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
          amount: paidAmount,
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
          conflictAmount: paidAmount,
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await dispatchStripeOpsAlerts(opsAlerts);
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

export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("[stripe webhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(checkoutSession);
        break;
      }
      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(checkoutSession);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe webhook] Handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
