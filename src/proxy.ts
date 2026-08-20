import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/about",
  "/contatti",
  "/maledizione",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/termini",
  "/cookie",
  "/auth",
  "/manutenzione",
];

const STATIC_FILE_EXT =
  /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mp4|pdf|png|svg|txt|webm|webp|woff2?)$/i;

function isPublicPath(pathname: string): boolean {
  if (STATIC_FILE_EXT.test(pathname)) return true;
  if (publicRoutes.includes(pathname)) return true;
  if (pathname.startsWith("/reset-password/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/rooms")) return true;
  if (pathname.startsWith("/api/media")) return true;
  if (pathname.startsWith("/api/webhook")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

function createSupabaseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
          });
        },
      },
    },
  );
}

/**
 * Next.js 16: convenzione `proxy.ts` (ex middleware).
 * Manutenzione, refresh sessione Supabase e auth gate ottimistico.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (STATIC_FILE_EXT.test(pathname)) {
    return NextResponse.next();
  }

  if (MAINTENANCE.enabled) {
    if (pathname === "/" || pathname === MAINTENANCE.path) {
      return NextResponse.rewrite(new URL(MAINTENANCE.path, req.url));
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname === MAINTENANCE.path) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createSupabaseClient(req, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);
  const isPublicRoute = isPublicPath(pathname);

  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/auth|api/webhook|api/cron|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
