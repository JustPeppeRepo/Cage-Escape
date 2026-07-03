import { logError } from "@/lib/logger";

export async function sendPasswordResetEmail(input: {
  email: string;
  url: string;
}): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const { env } = await import("@/app/_lib/env");

  if (!env.RESEND_API_KEY) {
    logError(
      "auth",
      "Password reset email non configurata: RESEND_API_KEY mancante",
    );
    return {
      ok: false,
      error: "Servizio email non configurato",
      skipped: true,
    };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "Cage Room <onboarding@resend.dev>",
      to: input.email,
      subject: "Reimposta la password — Cage Room",
      text: [
        "Hai richiesto di reimpostare la password del tuo account Cage Room.",
        "",
        "Clicca sul link seguente per scegliere una nuova password:",
        input.url,
        "",
        "Se non hai richiesto tu questo messaggio, ignora questa email.",
      ].join("\n"),
    });

    if (error) {
      logError("auth", "Resend API error (password reset)", {
        message: error.message,
      });
      return { ok: false, error: "Invio email non riuscito" };
    }

    return { ok: true };
  } catch (error) {
    logError("auth", "Unexpected password reset email error", error);
    return { ok: false, error: "Invio email non riuscito" };
  }
}
