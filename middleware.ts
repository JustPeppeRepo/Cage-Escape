import NextAuth from "next-auth"
import { authConfig } from "@/auth.config" // Assicurati che il path sia corretto per la tua struttura
import { NextResponse } from "next/server"

// Inizializziamo la versione "Edge" di NextAuth usando solo la configurazione base
const { auth } = NextAuth(authConfig)

// Route pubbliche (accessibili senza login)
const publicRoutes = ["/", "/login", "/signup"]

function isPublicPath(pathname: string): boolean {
  if (publicRoutes.includes(pathname)) {
    return true
  }

  return (
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/checkout")
  )
}

// Route che richiedono ruolo ADMIN
const adminRoutes = ["/admin"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  const isPublicRoute = isPublicPath(nextUrl.pathname)
  const isAdminRoute = adminRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )

  // 1. Non loggato e route privata -> redirect a login
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Loggato ma senza ruolo ADMIN su route admin -> redirect alla home
  if (isAdminRoute && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // 3. Loggato che prova ad accedere a login/signup -> redirect alla home
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
})

// Esclude asset statici, immagini, api routes di NextAuth stesso
export const config = {
  matcher: ["/((?!api/auth|api/webhook|_next/static|_next/image|favicon.ico).*)"],
}