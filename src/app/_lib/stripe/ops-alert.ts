import { logError } from "@/lib/logger";

export async function sendStripeOpsAlert(input: {
  subject: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const { env } = await import("@/app/_lib/env");

  const recipient = env.STRIPE_OPS_EMAIL_TO ?? env.CONTACT_EMAIL_TO;
  if (!env.RESEND_API_KEY || !recipient) {
    logError(
      "stripe-ops",
      "Alert email non configurata: RESEND_API_KEY o STRIPE_OPS_EMAIL_TO/CONTACT_EMAIL_TO mancanti",
      input,
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "Cage Room Ops <onboarding@resend.dev>",
      to: recipient,
      subject: `[Stripe Ops] ${input.subject}`,
      text: [
        input.subject,
        "",
        JSON.stringify(input.details, null, 2),
        "",
        "Intervento manuale richiesto.",
      ].join("\n"),
    });

    if (error) {
      logError("stripe-ops", "Resend API error", { message: error.message, input });
    }
  } catch (error) {
    logError("stripe-ops", "Unexpected alert email error", error);
  }
}
