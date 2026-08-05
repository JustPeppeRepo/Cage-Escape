import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { safePostgresFixedWindowCount } from "@/app/_lib/rate-limit-db";
import { env } from "@/app/_lib/env";
import { logError } from "@/lib/logger";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_SECONDS = 60;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitOptions = {
  userId?: string;
  /** Finestra fissa in secondi (default 60). Es. 3600 = 1 ora. */
  windowSeconds?: number;
};

async function resolveClientIp(): Promise<string> {
  const headerStore = await headers();
  // Su Vercel/proxy trusted l'IP client e' in x-real-ip oppure e' il PRIMO
  // hop di x-forwarded-for (leftmost). Usare l'ultimo hop rate-limitava il
  // proxy interno, non l'attaccante.
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headerStore.get("x-forwarded-for");
  const forwardedIps = forwarded
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return forwardedIps?.[0] ?? "unknown";
}

function buildRateLimitKey(
  action: string,
  ip: string,
  options?: RateLimitOptions,
): string {
  const windowSeconds = options?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  // Include la finestra nella chiave cosi' limiti orari e al minuto non collidono.
  const windowPart = windowSeconds === DEFAULT_WINDOW_SECONDS ? "" : `:w${windowSeconds}`;

  if (options?.userId) {
    return `ratelimit:${action}${windowPart}:user:${options.userId}`;
  }

  return `ratelimit:${action}${windowPart}:ip:${ip}`;
}

function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true };
}

/**
 * Rate limit distribuito su Neon (fail-closed in produzione).
 * In locale, se Postgres non e' raggiungibile, fallback in-memory per-processo.
 */
export async function checkRateLimit(
  action: string,
  maxRequests: number,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const windowSeconds = options?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const ip = await resolveClientIp();
  const key = buildRateLimitKey(action, ip, options);

  const count = await safePostgresFixedWindowCount(key, windowSeconds);
  if (count !== null) {
    if (count > maxRequests) {
      return { allowed: false, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true };
  }

  // Neon irraggiungibile: in produzione (Vercel prod o NODE_ENV=production)
  // falliamo chiuso — degradare a in-memory per-istanza su Vercel
  // equivarrebbe a un bypass quasi totale del rate limit. In sviluppo/test
  // locale resta il fallback in-memory.
  const failClosed =
    env.VERCEL_ENV === "production" || env.NODE_ENV === "production";

  if (failClosed) {
    logError(
      "rate-limit",
      "Neon Postgres irraggiungibile in produzione: richiesta negata (fail-closed)",
    );
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  return checkInMemoryRateLimit(key, maxRequests, windowSeconds);
}

/** Risposta HTTP 429 standard per Route Handler / API. */
export function tooManyRequestsResponse(
  retryAfterSeconds: number,
  message = "Troppe richieste. Riprova più tardi.",
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

/**
 * Applica il rate limit in un Route Handler.
 * Ritorna una Response 429 da restituire subito, oppure `null` se consentito.
 */
export async function enforceApiRateLimit(
  action: string,
  maxRequests: number,
  options?: RateLimitOptions,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(action, maxRequests, options);
  if (!result.allowed) {
    return tooManyRequestsResponse(result.retryAfterSeconds);
  }
  return null;
}
