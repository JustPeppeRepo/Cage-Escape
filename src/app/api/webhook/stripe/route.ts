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
import { decimalToNumber } from "@/app/_lib/bookings/money";
import { isSlotAvailable } from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";

export const runtime = "nodejs";

function getExpectedAmount(
  paymentChoice: PaymentType,
  tier: {
    totalPrice: { toString(): string };
    depositPrice: { toString(): string };
  },
): number {
  const amount =
    paymentChoice === PaymentType.FULL ? tier.totalPrice : tier.depositPrice;
  return decimalToNumber(amount);
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

  await prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { room: { include: { pricingTiers: true } }, payments: true },
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
        return;
      }

      // Idempotenza: conflitto gia rilevato e segnalato in una consegna precedente.
      if (booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED) {
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
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        return;
      }

      // Il checkout crea sempre sessioni in "eur" (bookings.ts), ma non ci
      // fidiamo implicitamente del tipo di evento: verifichiamo comunque la
      // valuta effettiva della sessione pagata prima di confermare, stesso
      // trattamento del mismatch di importo qui sotto.
      if (checkoutSession.currency !== "eur") {
        console.error(
          "[stripe webhook] Valuta inattesa - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            currency: checkoutSession.currency,
          }),
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
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
        console.error(
          "[stripe webhook] Nessuna fascia di prezzo trovata - rimborso manuale richiesto:",
          JSON.stringify({
            bookingId: booking.id,
            paymentIntentId,
            roomId: booking.roomId,
            participantCount: booking.participantCount,
          }),
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
        return;
      }

      const expectedAmount = getExpectedAmount(paymentChoice, tier);
      const paidAmount = (checkoutSession.amount_total ?? 0) / 100;

      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        // L'importo incassato da Stripe non coincide con quello atteso (es.
        // la fascia di prezzo e cambiata tra la creazione della sessione e
        // la consegna del webhook). Non confermiamo mai un pagamento sulla
        // base di un importo che non sappiamo validare: meglio un falso
        // rimborso manuale che una prenotazione confermata a un prezzo errato.
        console.error(
          "[stripe webhook] AMOUNT MISMATCH - rimborso manuale richiesto:",
          JSON.stringify({ bookingId, expectedAmount, paidAmount, paymentChoice }),
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
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
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
              holdExpiresAt: null,
            },
          });
          return;
        }
      }

      try {
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
      } catch (updateError) {
        // Ultima rete di sicurezza: un webhook concorrente ha vinto
        // l'EXCLUDE constraint (booking_no_overlap_per_room) tra il nostro
        // controllo di disponibilita e il nostro update.
        console.error(
          "[stripe webhook] PAYMENT CONFLICT su update finale - rimborso manuale richiesto:",
          JSON.stringify({ bookingId: booking.id, paymentIntentId }),
          updateError,
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            holdExpiresAt: null,
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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

  if (booking.status !== BookingStatus.PENDING) {
    return;
  }

  await prisma.booking.update({
    where: { id: booking.id },
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
