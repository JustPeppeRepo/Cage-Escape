import { headers } from "next/headers";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;

export async function checkRateLimit(
  action: string,
  maxRequests: number,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  // L'ultimo hop della catena X-Forwarded-For e' quello aggiunto dal proxy
  // fidato (Vercel) piu' vicino al nostro server, quindi il piu' difficile
  // da falsificare per un client esterno. Il primo hop e' invece il valore
  // che il client stesso puo' impostare liberamente nell'header in ingresso.
  const forwardedIps = forwarded?.split(",").map((value) => value.trim()).filter(Boolean);
  const ip = forwardedIps?.at(-1) ?? headerStore.get("x-real-ip") ?? "unknown";
  const key = `${action}:${ip}`;
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
