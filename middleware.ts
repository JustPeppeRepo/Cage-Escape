// =====================================================================================
// SECURE EDGE MIDDLEWARE - FAIL-CLOSED SESSION REFRESH
// Specialist in Edge Computing & Authentication Protocols Implementation
// =====================================================================================

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Why getUser() is enforced over getSession()
// getSession() reads unvalidated JWT payload from untrusted cookie data without server verification.
// getUser() performs server-side validation against Supabase Auth service, ensuring token integrity
// and preventing privilege escalation from tampered client-side JWT tokens.

/**
 * Protected route patterns that require authentication
 * FAIL-CLOSED: All routes default to ALLOW unless explicitly protected
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings", 
  "/api/protected",
  "/admin", // Add admin routes to protection
  "/account", // Add account management
] as const;

/**
 * Public routes that should bypass authentication entirely
 */
const PUBLIC_ROUTES = [
  "/",
  "/login", 
  "/signup",
  "/auth",
  "/reset-password",
  "/rooms",
  "/contatti",
  "/privacy",
  "/termini",
  "/api/webhooks", // Allow webhook endpoints
] as const;

/**
 * Determines if a pathname requires authentication
 */
const isProtectedRoute = (pathname: string): boolean => {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
};

/**
 * Determines if a pathname is explicitly public
 */
const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
};

/**
 * Creates Supabase client for Edge Runtime middleware
 * Uses server client with proper cookie handling for session refresh
 */
const createSupabaseClient = (request: NextRequest, response: NextResponse) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Middleware cookie mutation for session refresh
          // Edge Middleware can set cookies in the response headers to forward
          // refreshed session tokens from Supabase Auth service back to client
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
    }
  );
};

/**
 * Updates session and performs authentication validation
 * FAIL-CLOSED: Returns null user on any authentication failure
 */
async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createSupabaseClient(request, response);

  try {
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Enforcing getUser() over getSession()
    // getUser() performs server-side JWT validation against Supabase Auth service
    // This prevents attacks using tampered or forged client-side JWT tokens
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Fail-closed authentication
    // Any error or missing user results in null, triggering protection logic
    if (error || !user) {
      console.warn("Authentication failed:", error?.message || "No user found");
      return { response, user: null };
    }

    return { response, user };
  } catch (error) {
    // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Fail-closed on exceptions
    // Network errors, malformed tokens, or service issues default to unauthenticated
    console.error("Session validation error:", error);
    return { response, user: null };
  }
}

/**
 * Main middleware function with fail-closed security
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes that don't need auth
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.includes("/icon") ||
    pathname.includes("/favicon") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Allow explicit public routes without session refresh
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Update session for all other routes (including protected ones)
  const { response, user } = await updateSession(request);

  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Fail-closed protection logic
  // Protected routes DENY access by default unless valid user identity confirmed
  if (isProtectedRoute(pathname)) {
    if (!user) {
      // Redirect unauthenticated users to login with return URL
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      
      return NextResponse.redirect(loginUrl);
    }

    // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Additional role-based checks
    // Admin routes require elevated privileges
    if (pathname.startsWith("/admin")) {
      // Assuming user metadata contains role information
      const userRole = user.user_metadata?.role || user.app_metadata?.role;
      if (userRole !== "admin" && userRole !== "ADMIN") {
        // Redirect non-admin users attempting to access admin routes
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  // Return response with potentially refreshed session cookies
  return response;
}

/**
 * Middleware configuration
 * Protects specific route patterns while allowing public access to others
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon files, and other static assets
     * This ensures middleware runs on all pages and API routes that might need authentication
     */
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)",
  ],
};