import { headers } from "next/headers";
import {
  isRedisRateLimitConfigured,
  safeRedisFixedWindowCount,
} from "@/app/_lib/rate-limit-redis";
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
  const forwarded = headerStore.get("x-forwarded-for");
  const forwardedIps = forwarded
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return forwardedIps?.at(-1) ?? headerStore.get("x-real-ip") ?? "unknown";
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

  if (isRedisRateLimitConfigured()) {
    const count = await safeRedisFixedWindowCount(key, WINDOW_SECONDS);
    if (count !== null) {
      if (count > maxRequests) {
        return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
      }
      return { allowed: true };
    }

    // Redis e' configurato ma irraggiungibile (timeout, credenziali
    // invalide, downtime Upstash). In produzione degradare silenziosamente
    // a un contatore in-memory per-istanza equivarrebbe a un bypass quasi
    // totale del rate limit su un ambiente multi-istanza: falliamo chiuso
    // negando la richiesta, invece di aprire la porta al brute-force.
    if (env.NODE_ENV === "production") {
      logError(
        "rate-limit",
        "Upstash Redis irraggiungibile in produzione: richiesta negata (fail-closed)",
      );
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
  }

  // env.ts impone UPSTASH_REDIS_REST_URL/TOKEN in produzione: questo
  // fallback in-memory resta raggiungibile solo in sviluppo/test, dove
  // un'unica istanza di processo rende il contatore locale sufficiente.
  return checkInMemoryRateLimit(key, maxRequests);
}
