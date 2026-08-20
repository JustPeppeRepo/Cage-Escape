// =====================================================================================
// HARDENED KEEP-ALIVE ENDPOINT - SUPABASE FREE TIER
// Senior Full-Stack Developer & Cybersecurity Auditor Implementation
// =====================================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

// ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Cron Secret authorization check
// This endpoint MUST be protected by a secure authorization header to prevent:
// 1. Unauthorized keep-alive requests that could mask downtime
// 2. Resource abuse by external actors
// 3. Timing attacks to discover database connectivity

/**
 * Validates the cron authorization header
 * 
 * @param request - The incoming request
 * @returns boolean indicating if the request is authorized
 */
function validateCronAuthorization(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  
  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Strict header validation
  if (!authHeader) {
    console.warn("Keep-alive request missing authorization header");
    return false;
  }

  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET environment variable not configured");
    return false;
  }

  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Timing-safe comparison
  // Use constant-time comparison to prevent timing attacks
  if (authHeader.length !== expectedAuth.length) {
    return false;
  }

  // Simple constant-time comparison for header validation
  let isValid = true;
  for (let i = 0; i < authHeader.length; i++) {
    if (authHeader[i] !== expectedAuth[i]) {
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Performs a lightweight database connectivity check
 * 
 * @returns Promise with ping result and timing
 */
async function performDatabasePing() {
  const startTime = Date.now();
  
  try {
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Minimal read-only query
    // Use profiles table (created by our migration) for connectivity test
    // This query should be fast and not expose sensitive data
    const supabase = await createServerClient();
    
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .limit(1);

    const duration = Date.now() - startTime;

    if (error) {
      return {
        success: false,
        error: error.message,
        duration,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      duration,
      profileCount: count ?? 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown database error",
      duration,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Keep-Alive endpoint for Supabase Free Tier
 * 
 * This endpoint prevents database hibernation on Supabase Free Tier by:
 * 1. Performing a lightweight database query every 5 days
 * 2. Providing health monitoring information
 * 3. Maintaining connection pool warmth
 */
export async function GET(request: NextRequest) {
  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Authorization validation
  if (!validateCronAuthorization(request)) {
    console.warn("Unauthorized keep-alive attempt", {
      ip: request.headers.get("x-forwarded-for") || request.ip,
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Log authorized keep-alive execution
  console.info("Executing authorized keep-alive ping", {
    timestamp: new Date().toISOString(),
    source: "cron",
  });

  // Perform database connectivity check
  const pingResult = await performDatabasePing();

  // ⚠️ CRITICAL SECURITY CHECK [ROUTE_PROTECTION]: Secure response logging
  // Log results for monitoring but don't expose sensitive details in response
  if (pingResult.success) {
    console.info("Keep-alive ping successful", {
      duration: pingResult.duration,
      profileCount: pingResult.profileCount,
      timestamp: pingResult.timestamp,
    });

    return NextResponse.json({
      status: "healthy",
      timestamp: pingResult.timestamp,
      duration: pingResult.duration,
      message: "Database connection verified",
    });
  } else {
    console.error("Keep-alive ping failed", {
      error: pingResult.error,
      duration: pingResult.duration,
      timestamp: pingResult.timestamp,
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: pingResult.timestamp,
        duration: pingResult.duration,
        message: "Database connection failed",
      },
      { status: 503 }
    );
  }
}

// Ensure this runs on Edge Runtime for better performance and lower latency
export const runtime = "edge";
export const dynamic = "force-dynamic";