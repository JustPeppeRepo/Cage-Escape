// =====================================================================================
// SUPABASE ENVIRONMENT VARIABLE SCHEMA - SECURITY VALIDATION
// Senior Full-Stack Security Engineer Implementation
// =====================================================================================

import { z } from "zod";

/**
 * Secure environment schema for Supabase integration
 * Validates required variables and prevents misconfiguration
 */
export const supabaseEnvSchema = z.object({
  // ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Public variables only
  // These are the ONLY environment variables that should be used
  // in Supabase client utilities to prevent secret key exposure
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .refine(
      (url) => url.includes("supabase.co") || url.includes("localhost"),
      "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL"
    ),
  
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required")
    .refine(
      (key) => key.startsWith("eyJ") && key.length > 100,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT anon key"
    ),
});

/**
 * Validates Supabase-specific environment variables
 * Call this during application startup to catch configuration issues early
 */
export const validateSupabaseEnv = () => {
  const result = supabaseEnvSchema.safeParse(process.env);
  
  if (!result.success) {
    const errorMessages = result.error.issues
      .map(err => `- ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    
    throw new Error(
      `❌ Invalid Supabase environment variables:\n${errorMessages}\n\n` +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly."
    );
  }
  
  return result.data;
};

// Type export for use in other modules
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;