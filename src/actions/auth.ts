"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { APIError } from "better-auth"
import { auth } from "@/lib/auth"
import { checkRateLimit } from "@/app/_lib/rate-limit"

const signupSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(10)
})

export async function signup(prevState: unknown, formData: FormData) {
  // auth.api.signUpEmail e una chiamata server-side diretta: Better Auth
  // applica il proprio rate limiting solo alle richieste client-initiated
  // (vedi https://www.better-auth.com/docs/concepts/rate-limit), quindi le
  // customRules su /sign-up/email non hanno alcun effetto qui. Riusiamo lo
  // stesso helper gia usato dalle booking actions.
  const rateLimit = await checkRateLimit("signup", 5);
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

  const { username, email, password, phone } = parsed.data

  try {
    await auth.api.signUpEmail({
      body: {
        name: username,
        username,
        email,
        password,
        phone,
      },
    })
  } catch (error) {
    if (error instanceof APIError) {
      console.error("[signup] Better Auth error:", error.message)
      return { errors: { email: [error.message] } }
    }
    console.error("[signup] Unexpected error:", error)
    return { errors: { email: ["Errore durante la registrazione"] } }
  }

  redirect("/")
}
