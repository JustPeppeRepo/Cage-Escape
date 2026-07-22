import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/app/_lib/prisma";
import { env } from "@/app/_lib/env";
import { sendPasswordResetEmail } from "@/app/_lib/auth/email";

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
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ email: user.email, url });
    },
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 3 },
    },
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
