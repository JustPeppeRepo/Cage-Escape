import { logError } from "@/lib/logger";
import { getResendFromAddress } from "@/app/_lib/email/shared";

export async function sendContactNotificationEmail(input: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const { env } = await import("@/app/_lib/env");

  if (!env.RESEND_API_KEY || !env.CONTACT_EMAIL_TO) {
    logError("contact", "Email non configurata: RESEND_API_KEY o CONTACT_EMAIL_TO mancanti");
    return { ok: false, error: "Servizio email non configurato", skipped: true };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: getResendFromAddress("Cage Room", env.RESEND_FROM_EMAIL),
      to: env.CONTACT_EMAIL_TO,
      replyTo: input.email,
      subject: input.subject
        ? `[Contatti] ${input.subject}`
        : `[Contatti] Messaggio da ${input.name}`,
      text: [
        `Nome: ${input.name}`,
        `Email: ${input.email}`,
        input.subject ? `Oggetto: ${input.subject}` : null,
        "",
        input.message,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (error) {
      logError("contact", "Resend API error", { message: error.message });
      return { ok: false, error: "Invio email non riuscito" };
    }

    return { ok: true };
  } catch (error) {
    logError("contact", "Unexpected email error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: "Invio email non riuscito" };
  }
}
