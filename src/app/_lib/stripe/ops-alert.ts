import { sendOpsAlert } from "@/app/_lib/ops-alert";

// Wrapper mantenuto per compatibilità con i chiamanti esistenti (webhook
// Stripe, cancellazioni admin/utente): la logica di invio vera è ora
// condivisa in @/app/_lib/ops-alert per poter essere riusata anche da flussi
// non-Stripe (es. alert su invio email di reset password fallito).
export async function sendStripeOpsAlert(input: {
  subject: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await sendOpsAlert({ ...input, tag: "Stripe Ops" });
}
