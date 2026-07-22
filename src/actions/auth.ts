"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkRateLimit } from "@/app/_lib/rate-limit"
import { getLoginLockStatus } from "@/app/_lib/auth/lockout"
import { sanitizeCallbackUrl } from "@/lib/safe-redirect"

export type AuthFormState = {
  errors?: {
    email?: string[]
    password?: string[]
    username?: string[]
    phone?: string[]
  }
  success?: boolean
  callbackUrl?: string
  /** Signup: account creato, in attesa di verifica email. */
  needsEmailVerification?: boolean
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

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  })

  redirect("/")
}
