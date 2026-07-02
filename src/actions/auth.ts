"use server"

import bcrypt from "bcrypt"
import { z } from "zod"
import { prisma } from "@/app/_lib/prisma"
import { signIn } from "@/auth"
import { redirect } from "next/navigation"

const signupSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
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

  const { username, email, password, phone} = parsed.data
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await prisma.user.create({
      data: { username, email, hashedPassword, phone},
    })
  }
  catch(err){
    console.error(err)
  }
  await signIn("credentials", { email, password, redirect: false })

  redirect("/dashboard")
}