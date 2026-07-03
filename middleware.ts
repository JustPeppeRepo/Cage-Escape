import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Route pubbliche (accessibili senza login)
const publicRoutes = ["/", "/login", "/signup", "/about", "/contatti", "/maledizione", "/forgot-password", "/reset-password"]

function isPublicPath(pathname: string): boolean {
  if (publicRoutes.includes(pathname)) {
    return true
  }

  // /checkout NON e' pubblica: richiede login (vedi requireUser() in
  // src/app/checkout/page.tsx). Resta fuori da questa funzione cosi' il
  // check 1 qui sotto reindirizza al login con callbackUrl.
  return pathname.startsWith("/rooms")
}

// NOTA: la documentazione di Next.js descrive "middleware.ts" come
// convenzione deprecata in favore di "proxy.ts". Verificato empiricamente
// (next build, Turbopack) che in questa versione installata (16.2.9) solo
// "middleware.ts" con export "middleware"/default viene effettivamente
// caricato: un file "proxy.ts" con export "proxy" produce una build verde
// senza errori ma con middleware-manifest.json vuoto, cioe' NESSUNA
// protezione applicata. Restare su "middleware.ts" finche' l'upgrade a
// "proxy.ts" non sara' verificato di nuovo con una versione di Next.js che
// lo supporta davvero end-to-end (controllare .next/server/middleware-manifest.json
// dopo ogni tentativo di migrazione).
export default function middleware(req: NextRequest) {
  const { nextUrl } = req

  // Controllo "ottimistico": verifica solo la presenza del cookie di sessione,
  // senza toccare il DB (Prisma non e' eseguibile in questo runtime). Questo
  // NON valida la sessione ne' legge il ruolo utente: e' solo un filtro di
  // primo livello per evitare round-trip inutili verso pagine protette e per
  // reindirizzare subito gli utenti non loggati.
  //
  // L'autorizzazione reale (autenticazione E ruolo ADMIN) viene sempre
  // ri-verificata server-side con query al DB tramite requireUser()/
  // requireAdmin() (src/lib/dal.ts), chiamate in ogni singola page.tsx
  // protetta — non solo qui e non solo nei layout. Questo middleware e'
  // quindi difesa in profondita', non l'unica barriera: un domani un
  // refactor del matcher o della lista di route pubbliche non deve poter da
  // solo esporre dati o azioni riservate.
  const sessionCookie = getSessionCookie(req)
  const isLoggedIn = !!sessionCookie

  const isPublicRoute = isPublicPath(nextUrl.pathname)

  // 1. Non loggato su route privata (incluso /admin) -> redirect a login
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Loggato che prova ad accedere a login/signup -> redirect alla home
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
}

// Esclude asset statici, immagini, api routes di auth e il webhook Stripe
export const config = {
  matcher: ["/((?!api/auth|api/webhook|_next/static|_next/image|favicon.ico).*)"],
}
