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

export const runtime = "nodejs";

function getExpectedAmount(
  paymentChoice: PaymentType,
  prezzoTotale: { toString(): string },
  prezzoCaparra: { toString(): string },
): number {
  const amount =
    paymentChoice === PaymentType.FULL ? prezzoTotale : prezzoCaparra;
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
        include: { room: true, payments: true },
      });

      if (!booking) {
        console.error("[stripe webhook] Booking not found", bookingId);
        throw new Error("Booking not found");
      }

      // Idempotenza: evento gia elaborato in una consegna precedente.
      if (
        booking.status === BookingStatus.PAID ||
        booking.status === BookingStatus.DEPOSIT_PAID ||
        booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED
      ) {
        return;
      }

      const existingPayment = booking.payments.find(
        (payment) => payment.stripePaymentId === paymentIntentId,
      );
      if (existingPayment) {
        return;
      }

      const expectedAmount = getExpectedAmount(
        paymentChoice,
        booking.room.prezzoTotale,
        booking.room.prezzoCaparra,
      );
      const paidAmount = (checkoutSession.amount_total ?? 0) / 100;

      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.warn(
          "[stripe webhook] Amount mismatch",
          JSON.stringify({ bookingId, expectedAmount, paidAmount, paymentChoice }),
        );
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
