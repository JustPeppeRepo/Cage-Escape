import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET deve avere almeno 32 caratteri"),
    BETTER_AUTH_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // iubenda (opzionali): quando impostati, footer e banner cookie usano gli embed ufficiali
    NEXT_PUBLIC_IUBENDA_SITE_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_IUBENDA_TERMS_ID: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    // Indirizzo "from" su un dominio verificato Resend. Obbligatorio se
    // RESEND_API_KEY è impostata: senza, Resend non consegna agli utenti
    // reali. Vedi src/app/_lib/email/shared.ts.
    RESEND_FROM_EMAIL: z.string().email().optional(),
    CONTACT_EMAIL_TO: z.string().email().optional(),
    STRIPE_OPS_EMAIL_TO: z.string().email().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Presente su Vercel; assente in locale. Usato per fail-closed rate limit.
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.BETTER_AUTH_URL !== data.NEXT_PUBLIC_APP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL deve coincidere con NEXT_PUBLIC_APP_URL",
      });
    }

    // Con sola API key e senza from su dominio verificato, Resend accetta la
    // richiesta ma usa onboarding@resend.dev → consegna SOLO all'owner
    // dell'account. Le email di verifica/reset agli utenti reali non arrivano.
    if (data.RESEND_API_KEY && !data.RESEND_FROM_EMAIL) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_FROM_EMAIL"],
        message:
          "RESEND_FROM_EMAIL obbligatorio quando RESEND_API_KEY è impostata (indirizzo su dominio verificato Resend, es. noreply@cageroom.it)",
      });
    }

    // In produzione le email auth devono funzionare: senza chiave Resend
    // signup/login "sembrano" ok ma nessuna mail parte.
    if (data.NODE_ENV === "production" && !data.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message:
          "RESEND_API_KEY obbligatoria in produzione (verifica email / reset password)",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Variabili d'ambiente non valide:\n",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. Controlla il tuo .env");
}

export const env = parsed.data;

// I link in email (verifica/reset) e metadataBase usano queste URL.
// Se in produzione restano su *.vercel.app mentre il sito pubblico è
// cageroom.it, i link nelle mail puntano al dominio sbagliato e i cookie
// di sessione dopo verify/reset non valgono su cageroom.it.
if (
  env.NODE_ENV === "production" &&
  /vercel\.app$/i.test(new URL(env.NEXT_PUBLIC_APP_URL).hostname)
) {
  console.error(
    "❌ NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL puntano a un dominio Vercel " +
      `(${env.NEXT_PUBLIC_APP_URL}). Imposta entrambi a https://cageroom.it ` +
      "nelle env di produzione, altrimenti i link nelle email di verifica/reset " +
      "useranno cage-escape.vercel.app invece del dominio reale.",
  );
}
