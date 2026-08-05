import { checkRateLimit } from "@/app/_lib/rate-limit";
import type { AdminActionError } from "@/app/_lib/admin/action-result";
import { requireAdmin } from "@/lib/dal";

/**
 * Auth admin + rate limit per utente sulle Server Action mutanti.
 * Da chiamare come PRIMO step di ogni azione admin (prima della business logic).
 */
export async function requireAdminWithRateLimit(
  action: string,
  maxRequests = 30,
): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof requireAdmin>> }
  | { ok: false; result: AdminActionError }
> {
  const session = await requireAdmin();

  const rateLimit = await checkRateLimit(action, maxRequests, {
    userId: session.user.id,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false,
      result: {
        success: false,
        error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
      },
    };
  }

  return { ok: true, session };
}
