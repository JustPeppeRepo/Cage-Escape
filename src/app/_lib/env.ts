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

// #region agent log
const CHECK_KEYS = [
  "BETTER_AUTH_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;
const isBrowserContext = typeof window !== "undefined";
fetch('http://127.0.0.1:7808/ingest/f514f2e9-5ac4-48b3-b1b3-d645f78092c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ffe0c9'},body:JSON.stringify({sessionId:'ffe0c9',runId:'pre-fix',hypothesisId:'H1-H4-H5',location:'src/app/_lib/env.ts:pre-parse',message:'env var presence/length diagnostic',data:{isBrowserContext,vars:Object.fromEntries(CHECK_KEYS.map((k)=>[k,{isDefined:k in process.env,length:(process.env[k]??"").length,startsWithHttp:(process.env[k]??"").startsWith("http")}]))},timestamp:Date.now()})}).catch(()=>{});
// #endregion agent log

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // #region agent log
  const relevantIssues = parsed.error.issues
    .filter((issue) => CHECK_KEYS.includes(issue.path[0] as (typeof CHECK_KEYS)[number]))
    .map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }));
  fetch('http://127.0.0.1:7808/ingest/f514f2e9-5ac4-48b3-b1b3-d645f78092c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ffe0c9'},body:JSON.stringify({sessionId:'ffe0c9',runId:'pre-fix',hypothesisId:'H1-H4',location:'src/app/_lib/env.ts:parse-fail',message:'zod validation issues for target keys',data:{isBrowserContext,relevantIssues},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  console.error(
    "❌ Variabili d'ambiente non valide:\n",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. Controlla il tuo .env");
}

export const env = parsed.data;
