import { headers } from "next/headers";
import { safePostgresFixedWindowCount } from "@/app/_lib/rate-limit-db";
import { env } from "@/app/_lib/env";
import { logError } from "@/lib/logger";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const WINDOW_SECONDS = 60;

export type RateLimitOptions = {
  userId?: string;
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
  if (options?.userId) {
    return `ratelimit:${action}:user:${options.userId}`;
  }

  return `ratelimit:${action}:ip:${ip}`;
}

function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
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

export async function checkRateLimit(
  action: string,
  maxRequests: number,
  options?: RateLimitOptions,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const ip = await resolveClientIp();
  const key = buildRateLimitKey(action, ip, options);

  const count = await safePostgresFixedWindowCount(key, WINDOW_SECONDS);
  if (count !== null) {
    if (count > maxRequests) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
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
    return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  }

  return checkInMemoryRateLimit(key, maxRequests);
}
