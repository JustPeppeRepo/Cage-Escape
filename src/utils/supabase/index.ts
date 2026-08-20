// =====================================================================================
// SUPABASE UTILITIES - SECURE CLIENT EXPORTS
// Senior Full-Stack Security Engineer Implementation
// =====================================================================================

// ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Only secure client utilities exported
// This index file provides a clean interface to Supabase clients while
// maintaining strict security boundaries and preventing secret key exposure.

// Client utilities (zero secret exposure)
export { createClient as createBrowserClient } from "./client";
export { createClient as createServerClient } from "./server";

// Environment validation
export { validateSupabaseEnv, supabaseEnvSchema } from "./env-schema";
export type { SupabaseEnv } from "./env-schema";

// Re-export common types
export type { 
  SupabaseClient,
  User,
  Session,
  AuthError,
  AuthResponse,
  UserResponse,
} from "@supabase/supabase-js";

/**
 * USAGE GUIDELINES:
 * 
 * Browser/Client Components:
 * ```typescript
 * import { createBrowserClient } from "@/utils/supabase";
 * const supabase = createBrowserClient();
 * ```
 * 
 * Server Components:
 * ```typescript
 * import { createServerClient } from "@/utils/supabase";
 * const supabase = await createServerClient();
 * ```
 * 
 * Server Actions/Route Handlers:
 * ```typescript
 * import { createServerClient } from "@/utils/supabase";
 * const supabase = await createServerClient();
 * // Cookie mutations allowed in these contexts
 * ```
 * 
 * SECURITY NOTES:
 * - All clients use anon key only (RLS enforced)
 * - No service_role key exposure in any context
 * - Server client handles cookie chunking automatically
 * - Cookie mutations safe-fail in Server Components
 */