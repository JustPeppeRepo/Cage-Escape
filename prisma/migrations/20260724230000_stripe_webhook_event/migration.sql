-- Idempotenza webhook Stripe: event.id (evt_...) univoco.
CREATE TABLE "stripe_webhook_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stripe_webhook_event_type_idx" ON "stripe_webhook_event"("type");
