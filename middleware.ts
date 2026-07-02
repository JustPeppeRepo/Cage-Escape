import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

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

export default function middleware(req: NextRequest) {
  const { nextUrl } = req

  // Controllo "ottimistico": verifica solo la presenza del cookie di sessione,
  // senza toccare il DB (Prisma non e Edge-safe). Questo NON valida la
  // sessione ne legge il ruolo utente: e solo un filtro di primo livello per
  // evitare round-trip inutili verso pagine protette. L'autorizzazione reale
  // (incluso il controllo ADMIN) va ri-verificata server-side (Node runtime)
  // nel layout/page delle rotte protette tramite auth.api.getSession().
  const sessionCookie = getSessionCookie(req)
  const isLoggedIn = !!sessionCookie

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

  // 2. Non loggato su route admin -> redirect alla home
  //    (il controllo del ruolo ADMIN vero e proprio va rifatto server-side,
  //    perche il cookie non espone il ruolo in Edge Runtime senza query DB)
  if (isAdminRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // 3. Loggato che prova ad accedere a login/signup -> redirect alla home
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
}

// Esclude asset statici, immagini, api routes di auth e il webhook Stripe
export const config = {
  matcher: ["/((?!api/auth|api/webhook|_next/static|_next/image|favicon.ico).*)"],
}
