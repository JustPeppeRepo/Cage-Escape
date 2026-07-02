"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { APIError } from "better-auth"
import { auth } from "@/lib/auth"

const signupSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(10)
})

export async function signup(prevState: unknown, formData: FormData) {
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
