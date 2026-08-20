/**
 * Audit end-to-end flussi pagamento Stripe (Cage Room).
 *
 * Uso:
 *   npx tsx scripts/audit-stripe-payment-flows.ts
 *
 * Requisiti: .env valido, `next dev` su :3000, tabella stripe_webhook_event migrata.
 * Firma webhook: stripe.webhooks.generateTestHeaderString + STRIPE_WEBHOOK_SECRET locale.
 */
import "dotenv/config";
import { PrismaClient, BookingStatus, PaymentStatus, PaymentType, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Stripe from "stripe";

const WEBHOOK_URL =
  process.env.AUDIT_WEBHOOK_URL ?? "http://localhost:3000/api/webhook/stripe";
const WEBHOOK_URL_ALIAS =
  process.env.AUDIT_WEBHOOK_ALIAS_URL ??
  "http://localhost:3000/api/webhooks/stripe";

type CaseResult = { name: string; ok: boolean; detail: string };

const results: CaseResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}: ${detail}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function postWebhook(
  url: string,
  event: Record<string, unknown>,
  stripeClient: Stripe,
  secret: string,
): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify(event);
  const signature = stripeClient.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
}

function makeEvent(
  type: string,
  object: Record<string, unknown>,
  id?: string,
): Record<string, unknown> {
  return {
    id: id ?? `evt_audit_${type.replace(/\./g, "_")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2025-08-27.basil",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  };
}

async function main() {
  const secretKey = requireEnv("STRIPE_SECRET_KEY").trim().replace(/^["']|["']$/g, "");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET").trim().replace(/^["']|["']$/g, "");
  const databaseUrl = requireEnv("DATABASE_URL");

  const isTestKey =
    secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  if (!isTestKey) {
    throw new Error(
      "Audit consentito solo con chiavi test (sk_test_ / rk_test_). Chiave live rifiutata.",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

  console.log("\n=== Stripe payment flow audit ===\n");
  console.log(`Webhook: ${WEBHOOK_URL}`);

  // Health check
  try {
    const probe = await fetch(WEBHOOK_URL, { method: "POST", body: "{}" });
    if (probe.status === 404) {
      record("dev-server", false, "Webhook 404 — avvia npm run dev");
      throw new Error("Dev server non raggiungibile o route assente");
    }
    record("dev-server", true, `endpoint risponde (HTTP ${probe.status} atteso senza firma)`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Dev server")) throw error;
    record("dev-server", false, String(error));
    throw error;
  }

  // --- Bad signature ---
  {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify(makeEvent("checkout.session.completed", { id: "cs_x" })),
    });
    record(
      "reject-invalid-signature",
      res.status === 400,
      `HTTP ${res.status} (atteso 400)`,
    );
  }

  const room = await prisma.room.findFirst({
    where: { isActive: true },
    include: { pricingTiers: true },
  });
  if (!room || room.pricingTiers.length === 0) {
    throw new Error("Nessuna room attiva con pricing tiers — esegui seed");
  }

  const tier =
    room.pricingTiers.find((t) => t.minParticipants <= 2 && t.maxParticipants >= 2) ??
    room.pricingTiers[0]!;
  const expectedCents = Math.round(Number(tier.totalPrice.toString()) * 100);
  const depositCents = Math.round(Number(tier.depositPrice.toString()) * 100);

  const user =
    (await prisma.profiles.findFirst({ where: { role: Role.USER } })) ??
    (await prisma.profiles.findFirst());
  if (!user) {
    throw new Error(
      "Nessun profilo in public.profiles — crea un utente Auth (Supabase) e il relativo profilo prima dell'audit.",
    );
  }

  const createdBookingIds: string[] = [];
  const createdPaymentIntentIds: string[] = [];

  async function createPendingBooking(opts?: {
    paymentChoice?: PaymentType;
    holdExpired?: boolean;
    status?: BookingStatus;
  }) {
    // Slot lontano nel futuro + offset random per ridurre collisioni EXCLUDE
    const start = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10 + (createdBookingIds.length % 8), 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + createdBookingIds.length);
    const end = new Date(start.getTime() + room!.durationMinutes * 60_000);
    const paymentChoice = opts?.paymentChoice ?? PaymentType.FULL;
    const amount =
      paymentChoice === PaymentType.FULL ? tier.totalPrice : tier.depositPrice;

    const booking = await prisma.booking.create({
      data: {
        userId: user!.id,
        roomId: room!.id,
        startTime: start,
        endTime: end,
        totalAmount: amount,
        status: opts?.status ?? BookingStatus.PENDING,
        holdExpiresAt: opts?.holdExpired
          ? new Date(Date.now() - 60_000)
          : new Date(Date.now() + 10 * 60_000),
        paymentChoice,
        participantCount: Math.max(tier.minParticipants, 2),
        minorCount: 0,
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  // --- A) Happy path checkout.session.completed ---
  {
    const booking = await createPendingBooking();
    const piId = `pi_audit_ok_${Date.now()}`;
    createdPaymentIntentIds.push(piId);
    const eventId = `evt_audit_completed_ok_${Date.now()}`;
    const event = makeEvent(
      "checkout.session.completed",
      {
        id: `cs_audit_ok_${Date.now()}`,
        object: "checkout.session",
        payment_status: "paid",
        currency: "eur",
        amount_total: expectedCents,
        payment_intent: piId,
        metadata: {
          bookingId: booking.id,
          userId: user.id,
          paymentChoice: "FULL",
          roomId: room.id,
        },
        client_reference_id: booking.id,
      },
      eventId,
    );

    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true },
    });
    const evtRow = await prisma.stripeWebhookEvent.findUnique({
      where: { id: eventId },
    });

    const ok =
      res.status === 200 &&
      updated?.status === BookingStatus.PAID &&
      updated.payments.length === 1 &&
      updated.payments[0]?.status === PaymentStatus.SUCCEEDED &&
      evtRow !== null;

    record(
      "A-checkout.session.completed-happy",
      ok,
      `HTTP ${res.status}; status=${updated?.status}; payments=${updated?.payments.length}; eventRow=${Boolean(evtRow)}`,
    );

    // --- E) Duplicate same event.id ---
    const resDup = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const paymentsAfter = await prisma.payment.count({
      where: { bookingId: booking.id },
    });
    let dupBody: { duplicate?: boolean } = {};
    try {
      dupBody = JSON.parse(resDup.body) as { duplicate?: boolean };
    } catch {
      /* ignore */
    }
    record(
      "E-duplicate-event-id",
      resDup.status === 200 && paymentsAfter === 1 && dupBody.duplicate === true,
      `HTTP ${resDup.status}; body=${resDup.body}; payments=${paymentsAfter}`,
    );
  }

  // --- Amount mismatch ---
  {
    const booking = await createPendingBooking();
    const piId = `pi_audit_mismatch_${Date.now()}`;
    const event = makeEvent("checkout.session.completed", {
      id: `cs_audit_mismatch_${Date.now()}`,
      object: "checkout.session",
      payment_status: "paid",
      currency: "eur",
      amount_total: expectedCents + 500,
      payment_intent: piId,
      metadata: {
        bookingId: booking.id,
        userId: user.id,
        paymentChoice: "FULL",
        roomId: room.id,
      },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true },
    });
    record(
      "amount-mismatch-conflict",
      res.status === 200 &&
        updated?.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED &&
        updated.payments.length === 1,
      `HTTP ${res.status}; status=${updated?.status}; payments=${updated?.payments.length}`,
    );
  }

  // --- Metadata user mismatch ---
  {
    const booking = await createPendingBooking();
    const event = makeEvent("checkout.session.completed", {
      id: `cs_audit_meta_${Date.now()}`,
      object: "checkout.session",
      payment_status: "paid",
      currency: "eur",
      amount_total: expectedCents,
      payment_intent: `pi_audit_meta_${Date.now()}`,
      metadata: {
        bookingId: booking.id,
        userId: "user_attacker_not_owner",
        paymentChoice: "FULL",
        roomId: room.id,
      },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    record(
      "metadata-userId-mismatch",
      res.status === 200 &&
        updated?.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
      `HTTP ${res.status}; status=${updated?.status}`,
    );
  }

  // --- B) checkout.session.expired ---
  {
    const booking = await createPendingBooking();
    const event = makeEvent("checkout.session.expired", {
      id: `cs_audit_exp_${Date.now()}`,
      object: "checkout.session",
      metadata: { bookingId: booking.id },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    record(
      "B-checkout.session.expired",
      res.status === 200 && updated?.status === BookingStatus.CANCELLED,
      `HTTP ${res.status}; status=${updated?.status}`,
    );
  }

  // Expired must not cancel already PAID
  {
    const booking = await createPendingBooking({ status: BookingStatus.PAID });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { holdExpiresAt: null },
    });
    const event = makeEvent("checkout.session.expired", {
      id: `cs_audit_exp_paid_${Date.now()}`,
      object: "checkout.session",
      metadata: { bookingId: booking.id },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    record(
      "B-expired-ignores-PAID",
      res.status === 200 && updated?.status === BookingStatus.PAID,
      `HTTP ${res.status}; status=${updated?.status}`,
    );
  }

  // --- C) payment_intent.payment_failed (no-op) ---
  {
    const booking = await createPendingBooking();
    const event = makeEvent("payment_intent.payment_failed", {
      id: `pi_audit_fail_${Date.now()}`,
      object: "payment_intent",
      status: "requires_payment_method",
      metadata: { bookingId: booking.id },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    record(
      "C-payment_intent.payment_failed-noop",
      res.status === 200 && updated?.status === BookingStatus.PENDING,
      `HTTP ${res.status}; status=${updated?.status} (deve restare PENDING)`,
    );
  }

  // --- D) charge.refunded full ---
  {
    const booking = await createPendingBooking();
    const piId = `pi_audit_refund_${Date.now()}`;
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.PAID, holdExpiresAt: null },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripePaymentId: piId,
        amount: tier.totalPrice,
        type: PaymentType.FULL,
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
      },
    });

    const event = makeEvent("charge.refunded", {
      id: `ch_audit_refund_${Date.now()}`,
      object: "charge",
      amount: expectedCents,
      amount_refunded: expectedCents,
      refunded: true,
      currency: "eur",
      payment_intent: piId,
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true },
    });
    record(
      "D-charge.refunded-full",
      res.status === 200 &&
        updated?.status === BookingStatus.CANCELLED &&
        updated.payments.every((p) => p.status === PaymentStatus.REFUNDED),
      `HTTP ${res.status}; status=${updated?.status}; paymentStatuses=${updated?.payments.map((p) => p.status).join(",")}`,
    );
  }

  // --- D2) charge.refunded partial ---
  {
    const booking = await createPendingBooking();
    const piId = `pi_audit_partial_${Date.now()}`;
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.PAID, holdExpiresAt: null },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripePaymentId: piId,
        amount: tier.totalPrice,
        type: PaymentType.FULL,
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
      },
    });

    const event = makeEvent("charge.refunded", {
      id: `ch_audit_partial_${Date.now()}`,
      object: "charge",
      amount: expectedCents,
      amount_refunded: Math.floor(expectedCents / 2),
      refunded: false,
      currency: "eur",
      payment_intent: piId,
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true },
    });
    record(
      "D2-charge.refunded-partial-keeps-slot",
      res.status === 200 &&
        updated?.status === BookingStatus.PAID &&
        updated.payments[0]?.status === PaymentStatus.SUCCEEDED,
      `HTTP ${res.status}; status=${updated?.status}; payment=${updated?.payments[0]?.status}`,
    );
  }

  // --- Deposit path ---
  {
    const booking = await createPendingBooking({ paymentChoice: PaymentType.DEPOSIT });
    const event = makeEvent("checkout.session.completed", {
      id: `cs_audit_dep_${Date.now()}`,
      object: "checkout.session",
      payment_status: "paid",
      currency: "eur",
      amount_total: depositCents,
      payment_intent: `pi_audit_dep_${Date.now()}`,
      metadata: {
        bookingId: booking.id,
        userId: user.id,
        paymentChoice: "DEPOSIT",
        roomId: room.id,
      },
    });
    const res = await postWebhook(WEBHOOK_URL, event, stripe, webhookSecret);
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    record(
      "deposit-checkout-completed",
      res.status === 200 && updated?.status === BookingStatus.DEPOSIT_PAID,
      `HTTP ${res.status}; status=${updated?.status}`,
    );
  }

  // --- Real Stripe PaymentIntent + refund roundtrip (API, non solo payload sintetico) ---
  {
    try {
      const booking = await createPendingBooking();
      const pi = await stripe.paymentIntents.create({
        amount: expectedCents,
        currency: "eur",
        payment_method: "pm_card_visa",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { bookingId: booking.id, audit: "true" },
      });
      createdPaymentIntentIds.push(pi.id);

      if (pi.status !== "succeeded") {
        record("real-stripe-PI-confirm", false, `status=${pi.status}`);
      } else {
        const completed = makeEvent("checkout.session.completed", {
          id: `cs_audit_real_${Date.now()}`,
          object: "checkout.session",
          payment_status: "paid",
          currency: "eur",
          amount_total: expectedCents,
          payment_intent: pi.id,
          metadata: {
            bookingId: booking.id,
            userId: user.id,
            paymentChoice: "FULL",
            roomId: room.id,
          },
        });
        const res = await postWebhook(WEBHOOK_URL, completed, stripe, webhookSecret);
        const paid = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: { payments: true },
        });

        const refund = await stripe.refunds.create({ payment_intent: pi.id });
        const chargeId =
          typeof refund.charge === "string" ? refund.charge : refund.charge?.id;

        // Simula webhook charge.refunded (listen potrebbe non essere attivo)
        const charge = chargeId
          ? await stripe.charges.retrieve(chargeId)
          : null;

        if (charge) {
          const refundedEvt = makeEvent("charge.refunded", {
            id: charge.id,
            object: "charge",
            amount: charge.amount,
            amount_refunded: charge.amount_refunded,
            refunded: charge.refunded,
            currency: charge.currency,
            payment_intent: pi.id,
          });
          await postWebhook(WEBHOOK_URL, refundedEvt, stripe, webhookSecret);
        }

        const after = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: { payments: true },
        });

        record(
          "real-stripe-PI+refund-roundtrip",
          res.status === 200 &&
            paid?.status === BookingStatus.PAID &&
            after?.status === BookingStatus.CANCELLED &&
            after.payments.every((p) => p.status === PaymentStatus.REFUNDED),
          `confirm=${pi.status}; afterCompleted=${paid?.status}; afterRefund=${after?.status}`,
        );
      }
    } catch (error) {
      record(
        "real-stripe-PI+refund-roundtrip",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Alias path testato per ultimo: evita che errori HMR sull'alias
  // contaminino i test del path canonico.
  {
    const aliasEvt = makeEvent("payment_intent.payment_failed", {
      id: `pi_alias_${Date.now()}`,
      object: "payment_intent",
      status: "requires_payment_method",
    });
    const aliasRes = await postWebhook(
      WEBHOOK_URL_ALIAS,
      aliasEvt,
      stripe,
      webhookSecret,
    );
    record(
      "alias-/api/webhooks/stripe",
      aliasRes.status === 200,
      `HTTP ${aliasRes.status}`,
    );
  }

  // Cleanup audit bookings (best-effort)
  try {
    await prisma.payment.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    });
    await prisma.stripeWebhookEvent.deleteMany({
      where: { id: { startsWith: "evt_audit_" } },
    });
  } catch (error) {
    console.warn("Cleanup parziale:", error);
  }

  await prisma.$disconnect();
  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("All payment flow checks passed.");
  }
}

main().catch((error) => {
  console.error("\nAudit aborted:", error);
  process.exit(1);
});
