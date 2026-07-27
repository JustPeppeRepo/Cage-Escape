"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { APIError } from "better-auth"
import { auth } from "@/lib/auth"
import { checkRateLimit } from "@/app/_lib/rate-limit"
import { getLoginLockStatus } from "@/app/_lib/auth/lockout"
import { sanitizeCallbackUrl } from "@/lib/safe-redirect"
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/auth-constants"

export type AuthFormState = {
  errors?: {
    email?: string[]
    password?: string[]
    username?: string[]
    phone?: string[]
  }
  success?: boolean
  callbackUrl?: string
  /** Account in attesa di verifica email (signup o login bloccato). */
  needsEmailVerification?: boolean
  /** Email a cui è stata inviata la verifica (per UI / reinvio). */
  verificationEmail?: string
} | null

export type ResendVerificationState = {
  success?: boolean
  error?: string
  retryAfterSeconds?: number
} | null

const signupSchema = z.object({
  username: z.string().trim().min(2).max(32),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().trim().min(10).max(20),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
})

const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(255),
  callbackUrl: z.string().optional(),
})

/**
 * Controlli server prima del sign-in client (rate limit, Zod, lockout).
 * Il cookie di sessione lo imposta authClient.signIn.email sul browser.
 * Il lockout e' anche enforced in Better Auth hooks (src/lib/auth.ts):
 * questo check resta difesa in profondita' sul path UI.
 */
export async function prepareLogin(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rateLimit = await checkRateLimit("login", 5)
  if (!rateLimit.allowed) {
    return {
      errors: {
        email: [
          `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
        ],
      },
    }
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const callbackUrl = sanitizeCallbackUrl(
    formData.get("callbackUrl") as string | null,
  )

  const lockStatus = await getLoginLockStatus(parsed.data.email)
  if (lockStatus.locked) {
    return {
      errors: { email: ["Credenziali non valide"] },
    }
  }

  return { success: true, callbackUrl }
}

/**
 * Controlli server prima del sign-up client (rate limit + Zod).
 * Account + cookie li crea authClient.signUp.email sul browser.
 */
export async function prepareSignup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rateLimit = await checkRateLimit("signup", 5)
  if (!rateLimit.allowed) {
    return {
      errors: {
        email: [
          `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
        ],
      },
    }
  }

  const parsed = signupSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const callbackUrl = sanitizeCallbackUrl(
    formData.get("callbackUrl") as string | null,
  )

  return { success: true, callbackUrl }
}

/**
 * Reinvia l'email di verifica. Anti-enumerazione: messaggio generico anche
 * se l'email non esiste o è già verificata (comportamento Better Auth).
 */
export async function resendVerificationEmail(
  _prevState: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  const rateLimit = await checkRateLimit("resend-verification", 1)
  if (!rateLimit.allowed) {
    return {
      error: `Attendi ${rateLimit.retryAfterSeconds} secondi prima di richiedere un nuovo invio.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    }
  }

  const parsed = resendVerificationSchema.safeParse({
    email: formData.get("email"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  })

  if (!parsed.success) {
    return { error: "Indirizzo email non valido." }
  }

  const email = parsed.data.email.trim().toLowerCase()
  const callbackURL = sanitizeCallbackUrl(parsed.data.callbackUrl ?? null)

  try {
    await auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL,
      },
      headers: await headers(),
    })
  } catch (error) {
    if (error instanceof APIError) {
      console.error("[auth/resendVerificationEmail] APIError:", error.message)
    } else {
      console.error("[auth/resendVerificationEmail] Unexpected error:", error)
    }
    return {
      error:
        "Impossibile inviare l'email di verifica. Riprova più tardi o contatta lo staff.",
    }
  }

  return {
    success: true,
    retryAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
  }
}

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  })

  redirect("/")
}
