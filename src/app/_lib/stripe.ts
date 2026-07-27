import Stripe from "stripe";
import { env } from "@/app/_lib/env";
import { logError } from "@/lib/logger";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

const STRIPE_SECRET_KEY_PLACEHOLDERS = new Set([
  "sk_test_xxxx",
  "sk_live_xxxx",
  "rk_test_xxxx",
  "rk_live_xxxx",
]);

// Dettaglio della misconfigurazione: SOLO per uso server-side (log), non va
// mai restituito direttamente al client perché cita nomi di variabili
// d'ambiente e dove trovarle.
function getStripeConfigurationErrorDetail(): string | null {
  const key = env.STRIPE_SECRET_KEY.trim();

  if (
    STRIPE_SECRET_KEY_PLACEHOLDERS.has(key) ||
    key.includes("xxxx") ||
    key.length < 40
  ) {
    return "STRIPE_SECRET_KEY mancante o placeholder";
  }

  // Accetta secret key standard (sk_) e restricted key (rk_).
  // Le rk_ possono contenere underscore nel body.
  if (!/^[sr]k_(test|live)_[A-Za-z0-9_]+$/.test(key)) {
    return "STRIPE_SECRET_KEY non ha un formato valido";
  }

  return null;
}

// Messaggio generico, sicuro da mostrare all'utente finale. Il dettaglio
// reale della misconfigurazione viene loggato solo lato server.
export function getStripeConfigurationError(): string | null {
  const detail = getStripeConfigurationErrorDetail();
  if (!detail) {
    return null;
  }

  logError("stripe", "Stripe non configurato correttamente", { detail });
  return "Pagamento temporaneamente non disponibile. Riprova più tardi o contattaci.";
}

export function isStripeConfigurationError(error: unknown): boolean {
  if (getStripeConfigurationErrorDetail()) {
    return true;
  }

  return error instanceof Stripe.errors.StripeAuthenticationError;
}
