import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  APIError,
  createAuthMiddleware,
  createEmailVerificationToken,
} from "better-auth/api";
import { prisma } from "@/app/_lib/prisma";
import { env } from "@/app/_lib/env";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/app/_lib/auth/email";
import {
  getLoginLockStatus,
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from "@/app/_lib/auth/lockout";

function emailFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isCredentialAuthFailure(returned: unknown): boolean {
  if (!(returned instanceof APIError)) return false;
  // Solo fallimenti credenziali (password errata). Non contare 403
  // (email non verificata) né 429 (rate limit) come tentativi di lockout.
  return returned.statusCode === 401 || returned.status === "UNAUTHORIZED";
}

/**
 * Better Auth, con requireEmailVerification, risponde 200 anche a un signup
 * con email già registrata (anti-enumerazione) e NON invia la mail. Senza
 * questo hook un secondo tentativo di registrazione mostra "controlla
 * l'email" ma Resend non riceve nulla.
 */
async function sendVerificationToExistingUser(user: {
  email: string;
  emailVerified: boolean;
}) {
  if (user.emailVerified) return;

  const token = await createEmailVerificationToken(
    env.BETTER_AUTH_SECRET,
    user.email,
  );
  const url = `${env.BETTER_AUTH_URL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent("/")}`;
  const result = await sendVerificationEmail({ email: user.email, url });
  if (!result.ok) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: result.error,
    });
  }
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Esplicito invece di affidarsi al solo default (che ricaverebbe l'origin
  // fidato da baseURL): rende la configurazione auditabile e blocca richieste
  // cross-origin verso gli endpoint sensibili di Better Auth (CSRF/origin
  // check) anche se in futuro baseURL dovesse essere derivato diversamente.
  // In dev includiamo anche l'origin di rete (es. http://192.168.x.x:3000)
  // cosi' il login da telefono sulla LAN non fallisce il check CSRF.
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    ...(env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : []),
  ],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const result = await sendPasswordResetEmail({ email: user.email, url });
      if (!result.ok) {
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: result.error,
        });
      }
    },
    onExistingUserSignUp: async ({ user }) => {
      await sendVerificationToExistingUser(user);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // true: l'invio parte DENTRO il POST /sign-in/email (prima del 403).
    // Se lo spegnessimo, dipenderemmo solo dal Server Action di reinvio:
    // in produzione un fallimento di quel path non lascia traccia su Resend
    // per l'email reale dell'utente.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const result = await sendVerificationEmail({ email: user.email, url });
      if (!result.ok) {
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: result.error,
        });
      }
    },
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 1 },
      "/request-password-reset": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 3 },
    },
  },
  // Lockout account sul path Better Auth (/api/auth/sign-in/email), non solo
  // sul form UI: altrimenti un POST diretto bypasserebbe prepareLogin e le
  // Server Action reportLogin* (che erano anche abusabili da terzi).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const email = emailFromBody(ctx.body);
      if (!email) return;

      const lockStatus = await getLoginLockStatus(email);
      if (lockStatus.locked) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Credenziali non valide",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const email = emailFromBody(ctx.body);
      if (!email) return;

      if (ctx.context.newSession) {
        await resetLoginAttempts(email);
        return;
      }

      if (isCredentialAuthFailure(ctx.context.returned)) {
        await recordFailedLoginAttempt(email);
      }
    }),
  },
  // Esplicito invece di affidarsi ai default impliciti di Better Auth
  // (che sono corretti: httpOnly true, sameSite lax, secure derivato da
  // BETTER_AUTH_URL): rende la configurazione dei cookie di sessione
  // auditabile a colpo d'occhio nel repository, invece di dover verificare
  // il comportamento leggendo i sorgenti della libreria.
  advanced: {
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.BETTER_AUTH_URL.startsWith("https://"),
      path: "/",
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      username: { type: "string", required: true },
      phone: { type: "string", required: true },
      role: { type: "string", input: false, defaultValue: "USER" },
      failedLoginAttempts: { type: "number", input: false, defaultValue: 0 },
      lockedUntil: { type: "date", input: false, required: false },
    },
  },
  // nextCookies() deve restare l'ultimo plugin dell'array: imposta
  // automaticamente il cookie di sessione quando le API vengono chiamate
  // da Server Action/Route Handler.
  plugins: [nextCookies()],
});
