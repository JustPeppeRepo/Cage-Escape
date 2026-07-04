import { env } from "@/app/_lib/env";
import { logError } from "@/lib/logger";

type UpstashResponse = {
  result?: unknown;
  error?: string;
};

export function isRedisRateLimitConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand<T = unknown>(command: unknown[]): Promise<T> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis non configurato");
  }

  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash HTTP ${response.status}`);
  }

  const data = (await response.json()) as UpstashResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  return data.result as T;
}

export async function redisFixedWindowCount(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const count = await upstashCommand<number>(["INCR", key]);
  if (count === 1) {
    await upstashCommand(["EXPIRE", key, windowSeconds]);
  }
  return count;
}

export async function safeRedisFixedWindowCount(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  try {
    return await redisFixedWindowCount(key, windowSeconds);
  } catch (error) {
    logError("rate-limit", "Upstash Redis non disponibile", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
