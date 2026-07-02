import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { z } from "zod"
import { prisma } from "@/app/_lib/prisma"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password} = parsed.data

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.hashedPassword) return null

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword)
        if (!passwordsMatch){
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
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user){
        token.id = user.id
        token.role = user.role
      } 
      return token
    },
    async session({ session, token }) {
      if (session.user){
        session.user.id = token.id as string
        session.user.role = token.role as string
      } 
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})