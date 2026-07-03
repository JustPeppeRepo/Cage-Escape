"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { APIError } from "better-auth"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import { checkRateLimit } from "@/app/_lib/rate-limit"
import { sanitizeCallbackUrl } from "@/lib/safe-redirect"

// Limiti superiori oltre ai minimi: senza un max(), un payload con
// username/password/telefono enormi arriva fino all'hashing/DB prima di
// essere scartato (costo CPU/storage inutile, vettore di DoS a basso sforzo).
const signupSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  phone: z.string().min(10).max(20),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
})

function isUsernameConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("username")
  )
}

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
  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl") as string | null)

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
    if (isUsernameConflict(error)) {
      return { errors: { username: ["Username già in uso"] } }
    }
    if (error instanceof APIError) {
      // Messaggio generico anche qui (non solo nel login): il messaggio
      // originale di Better Auth per un'email gia' registrata la conferma
      // esplicitamente ("User already exists"), un oracolo di user
      // enumeration. Il dettaglio resta solo nel log server-side.
      console.error("[signup] Better Auth error:", error.message)
      return { errors: { email: ["Registrazione non riuscita. Verifica i dati o prova ad accedere."] } }
    }
    console.error("[signup] Unexpected error:", error)
    return { errors: { email: ["Errore durante la registrazione"] } }
  }

  redirect(callbackUrl)
}

export async function login(prevState: unknown, formData: FormData) {
  // Stesso motivo del signup: auth.api.signInEmail() e' una chiamata
  // server-side diretta, quindi il rate limit nativo di Better Auth su
  // /sign-in/email (customRules in src/lib/auth.ts) non scatta mai qui.
  // Senza questo controllo manuale il login sarebbe attaccabile via
  // brute-force/credential-stuffing senza alcun limite.
  const rateLimit = await checkRateLimit("login", 5);
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

  const { email, password } = parsed.data
  // Non ci fidiamo del valore che torna dal client nel campo hidden: viene
  // ri-sanitizzato qui prima di essere usato in redirect().
  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl") as string | null)

  try {
    await auth.api.signInEmail({
      body: { email, password },
    })
  } catch (error) {
    if (error instanceof APIError) {
      return {
        errors: { email: ["Credenziali non valide"] },
      }
    }
    console.error("[login] Unexpected error:", error)
    return { errors: { email: ["Errore durante l'accesso"] } }
  }

  redirect(callbackUrl)
}
