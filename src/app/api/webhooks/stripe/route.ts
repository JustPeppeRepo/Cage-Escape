/**
 * Alias path: alcuni tool / doc Stripe usano `/api/webhooks/stripe` (plurale).
 * L'implementazione canonica resta in `/api/webhook/stripe`.
 *
 * Wrapper esplicito: Next.js non permette di re-exportare `runtime`
 * (né altri route segment config) da un altro modulo.
 */
import type { NextResponse } from "next/server";
import { POST as handleStripeWebhook } from "@/app/api/webhook/stripe/route";

export const runtime = "nodejs";

export function POST(request: Request): Promise<NextResponse> {
  return handleStripeWebhook(request);
}
