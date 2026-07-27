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
 * Anti-enumerazione (requireSend=false): se l'email non esiste o è già
 * verificata, ritorna successo senza inviare.
 *
 * Dopo un login EMAIL_NOT_VERIFIED usa requireSend=true: un miss sul DB
 * (es. casing email) non deve mascherarsi da "email inviata".
 */
export async function issueAndSendVerificationEmail(input: {
  email: string;
  callbackUrl?: string | null;
  requireSend?: boolean;
}): Promise<IssueVerificationResult> {
  const email = input.email.trim().toLowerCase();
  const callbackURL = sanitizeCallbackUrl(input.callbackUrl ?? null);

  // Case-insensitive: Better Auth può autenticare con match case-insensitive
  // mentre findUnique su Postgres è case-sensitive → utente "trovato" al login
  // ma "mancante" qui → sent:false e UI che mente ("controlla la mail").
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, emailVerified: true },
  });

  if (!user) {
    console.info("[auth/issueVerification] user not found", {
      emailDomain: email.includes("@") ? email.split("@")[1] : null,
      requireSend: Boolean(input.requireSend),
    });
    if (input.requireSend) {
      return {
        ok: false,
        error: "Impossibile preparare l'email di verifica. Contatta lo staff.",
      };
    }
    return { ok: true, sent: false };
  }

  if (user.emailVerified) {
    console.info("[auth/issueVerification] already verified", {
      emailDomain: email.includes("@") ? email.split("@")[1] : null,
      requireSend: Boolean(input.requireSend),
    });
    if (input.requireSend) {
      return {
        ok: false,
        error:
          "Questo account risulta già verificato. Prova ad accedere di nuovo.",
      };
    }
    return { ok: true, sent: false };
  }

  const token = await createEmailVerificationToken(
    env.BETTER_AUTH_SECRET,
    user.email,
  );
  const url = `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;

  const result = await sendVerificationEmail({ email: user.email, url });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  console.info("[auth/issueVerification] sent", {
    emailDomain: user.email.includes("@") ? user.email.split("@")[1] : null,
  });
  return { ok: true, sent: true };
}
