import { z } from "zod";

/** `KEY=` o `KEY=""` nel .env non devono far fallire i campi opzionali. */
const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

const optionalNonEmpty = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalCronSecret = z.preprocess(
  emptyToUndefined,
  z.string().min(32, "CRON_SECRET deve avere almeno 32 caratteri").optional(),
);

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY è obbligatoria"),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    // Generata da te; su Vercel i cron la inviano come Bearer. Obbligatoria in prod.
    CRON_SECRET: optionalCronSecret,
    // iubenda (opzionali): quando impostati, footer e banner cookie usano gli embed ufficiali
    NEXT_PUBLIC_IUBENDA_SITE_ID: optionalNonEmpty,
    NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID: optionalNonEmpty,
    NEXT_PUBLIC_IUBENDA_TERMS_ID: optionalNonEmpty,
    RESEND_API_KEY: optionalNonEmpty,
    // Indirizzo "from" su un dominio verificato Resend. Obbligatorio se
    // RESEND_API_KEY è impostata: senza, Resend non consegna agli utenti
    // reali. Vedi src/app/_lib/email/shared.ts.
    RESEND_FROM_EMAIL: optionalEmail,
    CONTACT_EMAIL_TO: optionalEmail,
    STRIPE_OPS_EMAIL_TO: optionalEmail,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Presente su Vercel; assente in locale. Usato per fail-closed rate limit.
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  })
  .superRefine((data, ctx) => {
    // Con sola API key e senza from su dominio verificato, Resend accetta la
    // richiesta ma usa onboarding@resend.dev → consegna SOLO all'owner
    // dell'account. Le email di contatto/ops agli utenti reali non arrivano.
    if (data.RESEND_API_KEY && !data.RESEND_FROM_EMAIL) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_FROM_EMAIL"],
        message:
          "RESEND_FROM_EMAIL obbligatorio quando RESEND_API_KEY è impostata (indirizzo su dominio verificato Resend, es. noreply@cageroom.it)",
      });
    }

    // In produzione servono Resend (contatti + alert Stripe) e CRON_SECRET
    // (keep-alive Vercel). Le email Auth le invia Supabase, non Resend.
    if (data.NODE_ENV === "production" || data.VERCEL_ENV === "production") {
      if (!data.RESEND_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["RESEND_API_KEY"],
          message:
            "RESEND_API_KEY obbligatoria in produzione (form contatti e alert ops Stripe)",
        });
      }
      if (!data.CRON_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["CRON_SECRET"],
          message:
            "CRON_SECRET obbligatoria in produzione (Vercel Cron → /api/cron/keep-alive). Genera una stringa ≥ 32 caratteri e impostala in Vercel → Environment Variables.",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Variabili d'ambiente non valide:\n",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. Controlla il tuo .env (vedi .env.example)");
}

export const env = parsed.data;

// I link in email (reset) e metadataBase usano queste URL.
// Se in produzione restano su *.vercel.app mentre il sito pubblico è
// cageroom.it, i link nelle mail puntano al dominio sbagliato e i cookie
// di sessione dopo verify/reset non valgono su cageroom.it.
if (
  env.NODE_ENV === "production" &&
  /vercel\.app$/i.test(new URL(env.NEXT_PUBLIC_APP_URL).hostname)
) {
  console.error(
    "❌ NEXT_PUBLIC_APP_URL punta a un dominio Vercel " +
      `(${env.NEXT_PUBLIC_APP_URL}). Imposta https://cageroom.it ` +
      "nelle env di produzione, altrimenti callback auth, reset password e " +
      "success Stripe useranno cage-escape.vercel.app invece del dominio reale.",
  );
}
