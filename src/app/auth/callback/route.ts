// =====================================================================================
// SECURE PKCE AUTHENTICATION CALLBACK - EDGE RUNTIME
// Specialist in Edge Computing & Authentication Protocols Implementation  
// =====================================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Open redirect mitigation explanation
// Redirect target validation prevents attackers from using the auth callback
// as an open redirect vector by ensuring redirect URLs are:
// 1. Relative paths starting with "/" 
// 2. Not protocol-relative ("//evil.com")
// 3. Not absolute URLs to external domains
// This prevents phishing attacks where users authenticate successfully
// but get redirected to attacker-controlled domains.

/**
 * Validates redirect target to prevent Open Redirect vulnerabilities
 * 
 * @param redirectTo - The target URL to validate
 * @param fallback - Safe fallback URL if validation fails
 * @returns Sanitized redirect URL
 */
function sanitizeRedirectUrl(redirectTo: string | null, fallback = "/dashboard"): string {
  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Open redirect prevention
  if (!redirectTo) {
    return fallback;
  }

  try {
    // Check if it's a relative URL starting with "/"
    if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      // Additional validation: ensure it's not trying to escape with encoded characters
      const decoded = decodeURIComponent(redirectTo);
      if (decoded.startsWith("/") && !decoded.includes("://") && !decoded.startsWith("//")) {
        return decoded;
      }
    }

    // If URL parsing succeeds and it's the same origin, allow it
    const url = new URL(redirectTo, process.env.NEXT_PUBLIC_APP_URL);
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL!);
    
    if (url.origin === appUrl.origin) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // URL parsing failed, use fallback
  }

  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Reject potentially malicious redirects
  console.warn(`Rejected potentially malicious redirect target: ${redirectTo}`);
  return fallback;
}

/**
 * Creates server Supabase client for authentication operations
 */
async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
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
}

/**
 * Handle PKCE authentication callback
 * Exchanges authorization code for session tokens
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from provider
  if (error) {
    console.error("OAuth provider error:", { error, errorDescription });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth-failed");
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Validate presence of authorization code
  if (!code) {
    console.error("Missing authorization code in callback");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "missing-code");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();

    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: PKCE code exchange
    // Exchange the authorization code for session tokens using PKCE flow
    // This validates the code_verifier against the code_challenge sent during initial auth
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("PKCE code exchange failed:", exchangeError);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "auth-failed");
      loginUrl.searchParams.set("details", exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Validate session was created
    if (!data.session || !data.user) {
      console.error("Session creation failed despite successful code exchange");
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "session-failed");
      return NextResponse.redirect(loginUrl);
    }

    // Log successful authentication for security monitoring
    console.info("Successful authentication:", {
      userId: data.user.id,
      email: data.user.email,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get("user-agent"),
      ip: request.headers.get("x-forwarded-for"),
    });

    // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Sanitize redirect target
    const redirectUrl = sanitizeRedirectUrl(next);
    const successUrl = new URL(redirectUrl, request.url);

    return NextResponse.redirect(successUrl);

  } catch (error) {
    // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Fail-closed error handling
    console.error("Unexpected error in auth callback:", error);
    
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "callback-error");
    return NextResponse.redirect(loginUrl);
  }
}

// Force dynamic rendering for this route
export const runtime = "edge";
export const dynamic = "force-dynamic";