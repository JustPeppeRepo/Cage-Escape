// =====================================================================================
// SECURE SERVER ACTION AUTH VALIDATION
// Senior Full-Stack Developer & Cybersecurity Auditor Implementation
// =====================================================================================

import { createClient } from "@/utils/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Secure user validation for Server Actions
 * 
 * ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Server Action re-authorization check
 * NEVER trust client-side user context in Server Actions. This function:
 * 1. Creates a fresh server client with cookie validation
 * 2. Calls getUser() for server-side JWT verification against Supabase Auth
 * 3. Throws on any authentication failure (fail-closed security)
 * 
 * @returns Validated user object from Supabase Auth service
 * @throws Error if authentication fails or user is invalid
 */
export async function validateUserSession(): Promise<User> {
  // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Fresh server client creation
  // Always create a new server client to ensure latest cookie state
  const supabase = await createClient();

  // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Server-side user validation
  // getUser() performs JWT validation against Supabase Auth service
  // This prevents attacks using tampered client-side session data
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Fail-closed authentication
  // Any authentication error results in thrown exception
  if (error) {
    console.warn("Server Action authentication error:", error.message);
    throw new Error("Authentication failed");
  }

  if (!user) {
    console.warn("Server Action called without authenticated user");
    throw new Error("Unauthorized");
  }

  // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Additional user validation
  // Ensure user has required properties and is properly authenticated
  if (!user.id || !user.email) {
    console.warn("Server Action user missing required properties");
    throw new Error("Invalid user session");
  }

  return user;
}

/**
 * Secure admin role validation for Server Actions
 * 
 * @returns Validated admin user object
 * @throws Error if user is not authenticated or not an admin
 */
export async function validateAdminSession(): Promise<User> {
  const user = await validateUserSession();

  // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Admin role validation
  // Check user metadata for admin role
  const userRole = user.user_metadata?.role || user.app_metadata?.role;
  
  if (userRole !== "admin" && userRole !== "ADMIN") {
    console.warn(`Non-admin user ${user.id} attempted admin action`);
    throw new Error("Admin access required");
  }

  return user;
}

/**
 * Type-safe error handling for Server Actions
 */
export type SecureActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Wrapper for secure Server Actions with automatic error handling
 */
export async function secureServerAction<T>(
  action: (user: User) => Promise<T>,
  requireAdmin = false
): Promise<SecureActionResult<T>> {
  try {
    const user = requireAdmin 
      ? await validateAdminSession()
      : await validateUserSession();
    
    const data = await action(user);
    
    return { success: true, data };
  } catch (error) {
    console.error("Secure server action failed:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return { 
      success: false, 
      error: errorMessage === "Unauthorized" || errorMessage === "Authentication failed"
        ? "Authentication required"
        : errorMessage === "Admin access required"
        ? "Insufficient permissions"
        : "Action failed"
    };
  }
}