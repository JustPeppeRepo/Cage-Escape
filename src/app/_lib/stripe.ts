import Stripe from "stripe";
import { env } from "@/app/_lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

const STRIPE_SECRET_KEY_PLACEHOLDERS = new Set(["sk_test_xxxx", "sk_live_xxxx"]);

export function getStripeConfigurationError(): string | null {
  const key = env.STRIPE_SECRET_KEY.trim();

  if (
    STRIPE_SECRET_KEY_PLACEHOLDERS.has(key) ||
    key.includes("xxxx") ||
    key.length < 40
  ) {
    return "Stripe non è configurato: inserisci una STRIPE_SECRET_KEY valida nel file .env (Dashboard Stripe → Developers → API keys).";
  }

  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    return "STRIPE_SECRET_KEY non ha un formato valido.";
  }

  return null;
}

export function isStripeConfigurationError(error: unknown): boolean {
  if (getStripeConfigurationError()) {
    return true;
  }

  return error instanceof Stripe.errors.StripeAuthenticationError;
}
