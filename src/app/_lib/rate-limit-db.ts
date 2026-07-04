import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { logError } from "@/lib/logger";

type RateLimitRow = {
  count: number;
};

// Incremento atomico a finestra fissa: INSERT o UPSERT con reset automatico
// quando resetAt e' scaduto. Una sola query, sicura in concorrenza su piu'
// istanze serverless che condividono lo stesso Neon.
export async function postgresFixedWindowCount(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const rows = await prisma.$queryRaw<RateLimitRow[]>(
    Prisma.sql`
      INSERT INTO "RateLimitCounter" (key, count, "resetAt")
      VALUES (
        ${key},
        1,
        NOW() + make_interval(secs => ${windowSeconds})
      )
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN "RateLimitCounter"."resetAt" <= NOW() THEN 1
          ELSE "RateLimitCounter".count + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitCounter"."resetAt" <= NOW() THEN NOW() + make_interval(secs => ${windowSeconds})
          ELSE "RateLimitCounter"."resetAt"
        END
      RETURNING count
    `,
  );

  return rows[0]?.count ?? 1;
}

export async function safePostgresFixedWindowCount(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  try {
    return await postgresFixedWindowCount(key, windowSeconds);
  } catch (error) {
    logError("rate-limit", "Postgres rate limit non disponibile", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
