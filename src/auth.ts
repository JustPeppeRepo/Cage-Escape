import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { z } from "zod"
import { prisma } from "@/app/_lib/prisma"
import { authConfig } from "./auth.config"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig, // Estende la configurazione base
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.hashedPassword) return null

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED")
        }

        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword)
        if (!passwordsMatch) {
          const attempts = user.failedLoginAttempts + 1
          const MAX_ATTEMPTS = 5

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil:
                attempts >= MAX_ATTEMPTS
                  ? new Date(Date.now() + 15 * 60 * 1000)
                  : null,
            },
          })
          return null 
        }

        // Se il login va a buon fine, azzeriamo i tentativi falliti
        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: user.id,
          role: user.role,
          email: user.email,
          username: user.username,
        }
      },
    }),
  ],
})