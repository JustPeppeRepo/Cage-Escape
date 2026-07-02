import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  BookingStatus,
  PaymentStatus,
  PaymentType,
} from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { stripe } from "@/app/_lib/stripe";
import { env } from "@/app/_lib/env";
import { decimalToNumber } from "@/app/_lib/bookings/money";

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

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true, payments: true },
  });

  if (!booking) {
    console.error("[stripe webhook] Booking not found", bookingId);
    throw new Error("Booking not found");
  }

  if (
    booking.status === BookingStatus.PAID ||
    booking.status === BookingStatus.DEPOSIT_PAID
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
      JSON.stringify({
        bookingId,
        expectedAmount,
        paidAmount,
        paymentChoice,
      }),
    );
  }

  const nextStatus =
    paymentChoice === PaymentType.FULL
      ? BookingStatus.PAID
      : BookingStatus.DEPOSIT_PAID;

  await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });

    if (
      !current ||
      current.status === BookingStatus.PAID ||
      current.status === BookingStatus.DEPOSIT_PAID
    ) {
      return;
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: nextStatus,
        holdExpiresAt: null,
        stripeSessionId: checkoutSession.id,
      },
    });

    await tx.payment.create({
      data: {
        bookingId,
        stripePaymentId: paymentIntentId,
        amount: expectedAmount,
        type: paymentChoice,
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
      },
    });
  });
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
