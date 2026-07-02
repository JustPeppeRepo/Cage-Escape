import { auth } from "@/auth"
import { NextResponse } from "next/server"

// Route pubbliche (accessibili senza login)
const publicRoutes = ["/", "/login", "/signup"]

// Route che richiedono ruolo ADMIN (adatta ai tuoi valori enum)
const adminRoutes = ["/admin"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  const isPublicRoute = publicRoutes.includes(nextUrl.pathname)
  const isAdminRoute = adminRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )

  // Non loggato e route privata -> redirect a login
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Loggato ma senza ruolo ADMIN su route admin -> redirect o 403
  if (isAdminRoute && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Loggato che prova ad accedere a login/signup -> redirect a dashboard
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
})

// Esclude asset statici, immagini, api routes di NextAuth stesso
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}