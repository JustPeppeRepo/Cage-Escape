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
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.BETTER_AUTH_URL !== data.NEXT_PUBLIC_APP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL deve coincidere con NEXT_PUBLIC_APP_URL",
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
