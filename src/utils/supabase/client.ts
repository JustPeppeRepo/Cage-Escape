// =====================================================================================
// SECURE SUPABASE BROWSER CLIENT - ZERO SECRET EXPOSURE
// Senior Full-Stack Security Engineer Implementation
// =====================================================================================

import { createBrowserClient } from "@supabase/ssr";

// ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Confirming no service_role key exposure
// This client utility EXCLUSIVELY uses public environment variables.
// SUPABASE_SERVICE_ROLE_KEY is FORBIDDEN in browser contexts to prevent
// privilege escalation and unauthorized database access.

/**
 * Strictly typed environment variables for browser client
 * Only public keys are allowed in the browser bundle
 */
const getPublicEnvVars = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Runtime validation to prevent undefined values reaching production
  if (!supabaseUrl) {
    throw new Error(
      "SECURITY ERROR: NEXT_PUBLIC_SUPABASE_URL is required for browser client initialization"
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "SECURITY ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is required for browser client initialization"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  } as const;
};

/**
 * Creates a secure Supabase client for browser environments
 * 
 * SECURITY FEATURES:
 * - Uses only public anon key (Row Level Security enforced)
 * - No server-side secret key exposure risk
 * - Automatic client-side session management
 * - Cookie-based authentication state persistence
 * 
 * @returns Configured Supabase browser client with RLS protection
 */
export const createClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnvVars();

  // ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Explicit confirmation - no service_role key used
  // This browser client uses createBrowserClient with anon key only.
  // All database operations will be subject to Row Level Security policies.
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// Re-export types for convenience
export type { SupabaseClient } from "@supabase/supabase-js";