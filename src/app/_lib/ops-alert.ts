import { logError } from "@/lib/logger";
import { getResendFromAddress } from "@/app/_lib/email/shared";

/**
 * Alert operativo generico via email, per qualsiasi flusso critico che
 * fallisce silenziosamente per l'utente finale (pagamenti, rimborsi, invio
 * email di sistema come il reset password). Il destinatario è sempre
 * l'indirizzo dello staff (STRIPE_OPS_EMAIL_TO/CONTACT_EMAIL_TO), quindi
 * l'invio funziona anche quando si usa ancora il dominio di test
 * "onboarding@resend.dev" di Resend (che consente l'invio solo al
 * proprietario dell'account).
 */
export async function sendOpsAlert(input: {
  subject: string;
  details: Record<string, unknown>;
  tag?: string;
}): Promise<void> {
  const { env } = await import("@/app/_lib/env");
  const tag = input.tag ?? "Ops";

  const recipient = env.STRIPE_OPS_EMAIL_TO ?? env.CONTACT_EMAIL_TO;
  if (!env.RESEND_API_KEY || !recipient) {
    // Logghiamo solo il subject, non l'intero `details`: puo' contenere
    // email utente o altri dati sensibili che non devono finire nei log del
    // provider (Vercel).
    logError(
      "ops-alert",
      "Alert email non configurata: RESEND_API_KEY o STRIPE_OPS_EMAIL_TO/CONTACT_EMAIL_TO mancanti",
      { subject: input.subject, tag },
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: getResendFromAddress("Cage Room Ops", env.RESEND_FROM_EMAIL),
      to: recipient,
      subject: `[${tag}] ${input.subject}`,
      text: [
        input.subject,
        "",
        JSON.stringify(input.details, null, 2),
        "",
        "Intervento manuale richiesto.",
      ].join("\n"),
    });

    if (error) {
      logError("ops-alert", "Resend API error", {
        message: error.message,
        subject: input.subject,
      });
    }
  } catch (error) {
    logError("ops-alert", "Unexpected alert email error", {
      message: error instanceof Error ? error.message : String(error),
      subject: input.subject,
    });
  }
}
