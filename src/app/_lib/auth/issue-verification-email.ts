import { createEmailVerificationToken } from "better-auth/api";
import { prisma } from "@/app/_lib/prisma";
import { env } from "@/app/_lib/env";
import { sendVerificationEmail } from "@/app/_lib/auth/email";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

export type IssueVerificationResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: string };

/**
 * Crea il token e chiama Resend direttamente, senza passare da
 * Better Auth `runInBackgroundOrAwait` (che inghiotte gli errori su
 * signup/signin) né da `auth.api.sendVerificationEmail`.
 *
 * Anti-enumerazione: se l'email non esiste o è già verificata, ritorna
 * successo senza inviare.
 */
export async function issueAndSendVerificationEmail(input: {
  email: string;
  callbackUrl?: string | null;
}): Promise<IssueVerificationResult> {
  const email = input.email.trim().toLowerCase();
  const callbackURL = sanitizeCallbackUrl(input.callbackUrl ?? null);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, emailVerified: true },
  });

  if (!user || user.emailVerified) {
    return { ok: true, sent: false };
  }

  const token = await createEmailVerificationToken(
    env.BETTER_AUTH_SECRET,
    user.email,
  );
  const url = `${env.BETTER_AUTH_URL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;

  const result = await sendVerificationEmail({ email: user.email, url });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, sent: true };
}
