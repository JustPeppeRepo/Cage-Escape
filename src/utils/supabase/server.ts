// =====================================================================================
// SECURE SUPABASE SERVER CLIENT - NEXT.JS APP ROUTER OPTIMIZED
// Senior Full-Stack Security Engineer Implementation
// =====================================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Confirming no service_role key exposure
// This server client utility EXCLUSIVELY uses public environment variables.
// SUPABASE_SERVICE_ROLE_KEY is FORBIDDEN to prevent accidental privilege escalation
// and maintain zero-trust security posture with RLS enforcement.

/**
 * Strictly typed environment variables for server client
 * Only public keys are allowed to maintain RLS security boundaries
 */
const getPublicEnvVars = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Runtime validation to prevent undefined values reaching production
  if (!supabaseUrl) {
    throw new Error(
      "SECURITY ERROR: NEXT_PUBLIC_SUPABASE_URL is required for server client initialization"
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "SECURITY ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is required for server client initialization"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  } as const;
};

/**
 * Creates a secure Supabase client for Next.js App Router server environments
 * 
 * SECURITY FEATURES:
 * - Uses only public anon key (Row Level Security enforced)
 * - No server-side secret key exposure risk
 * - Proper cookie chunking for Next.js App Router
 * - Safe cookie mutation handling with Server Component compatibility
 * - Automatic session management with secure cookie attributes
 * 
 * COOKIE HANDLING CONSTRAINTS:
 * - Server Components: Cannot set cookies (read-only access)
 * - Server Actions: Can set cookies (cookie mutations allowed)
 * - Route Handlers: Can set cookies (cookie mutations allowed)
 * 
 * @returns Promise<SupabaseClient> - Configured server client with RLS protection
 */
export const createClient = async () => {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnvVars();
  const cookieStore = await cookies();

  // ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Explicit confirmation - no service_role key used
  // This server client uses createServerClient with anon key only.
  // All database operations will be subject to Row Level Security policies.
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Secure cookie getter - safe for all server contexts
      getAll() {
        return cookieStore.getAll();
      },

      // ⚠️ CRITICAL SECURITY CHECK [COOKIE_HANDLING]: Cookie mutation scope explanation
      // setAll is used for session management and cookie chunking in App Router.
      // Server Components cannot set cookies - this will be called from:
      // - Server Actions (allowed)
      // - Route Handlers (allowed)  
      // - Middleware (allowed)
      // Server Component calls will silently fail (absorbed by try/catch)
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              // Enforce secure cookie attributes for production
              httpOnly: options?.httpOnly ?? true,
              secure: options?.secure ?? process.env.NODE_ENV === "production",
              sameSite: options?.sameSite ?? "lax",
              // Default path for Supabase auth cookies
              path: options?.path ?? "/",
            });
          });
        } catch (error) {
          // ⚠️ CRITICAL SECURITY CHECK [COOKIE_HANDLING]: Absorb cookie setting errors
          // Server Components cannot set cookies. This try/catch prevents crashes
          // when Supabase attempts to refresh tokens from Server Components.
          // This is expected behavior in Next.js App Router architecture.
          
          // Log in development for debugging but don't crash in production
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Cookie setting failed (expected in Server Components):",
              error instanceof Error ? error.message : "Unknown cookie error"
            );
          }
        }
      },
    },
  });
};

// Re-export types for convenience
export type { SupabaseClient } from "@supabase/supabase-js";