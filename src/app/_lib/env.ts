import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve avere almeno 32 caratteri"),
  
  // Se usi provider OAuth in futuro, aggiungi qui (opzionali per ora)
  // AUTH_GOOGLE_ID: z.string().optional(),
  // AUTH_GOOGLE_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Variabili d'ambiente non valide:\n",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. Controlla il tuo .env.local");
}

export const env = parsed.data;