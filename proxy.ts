import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { MAINTENANCE } from "@/app/_lib/site/maintenance"

// Route pubbliche (accessibili senza login)
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/about",
  "/contatti",
  "/maledizione",
  "/forgot-password",
  "/reset-password",
]

/** Asset in /public: non devono passare dal gate auth. */
const STATIC_FILE_EXT =
  /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mp4|pdf|png|svg|txt|webm|webp|woff2?)$/i

function isPublicPath(pathname: string): boolean {
  if (STATIC_FILE_EXT.test(pathname)) return true
  if (publicRoutes.includes(pathname)) return true
  return pathname.startsWith("/rooms")
}

/**
 * Next.js 16: convenzione `proxy.ts` (ex middleware).
 * Manutenzione e auth gate ottimistico vivono qui.
 */
export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (STATIC_FILE_EXT.test(pathname)) {
    return NextResponse.next()
  }

  if (MAINTENANCE.enabled) {
    // Home (e path interno) → pagina muta. Tutto il resto → `/`.
    if (pathname === "/" || pathname === MAINTENANCE.path) {
      return NextResponse.rewrite(new URL(MAINTENANCE.path, req.url))
    }
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (pathname === MAINTENANCE.path) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  const sessionCookie = getSessionCookie(req)
  const isLoggedIn = !!sessionCookie
  const isPublicRoute = isPublicPath(pathname)

  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|api/webhook|api/media|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}
