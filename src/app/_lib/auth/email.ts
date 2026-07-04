import { logError } from "@/lib/logger";
import {
  getResendFromAddress,
  isSandboxDomainRestrictionError,
} from "@/app/_lib/email/shared";

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
      from: getResendFromAddress("Cage Room", env.RESEND_FROM_EMAIL),
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

      // Senza un dominio verificato (RESEND_FROM_EMAIL), Resend rifiuta con
      // un 403 ogni invio verso un indirizzo diverso da quello del
      // proprietario dell'account: il reset password per utenti reali non
      // funzionerebbe MAI silenziosamente. Segnaliamo il caso in modo
      // esplicito nei log e avvisiamo lo staff (l'alert arriva comunque,
      // perché è diretto all'indirizzo dello staff stesso).
      const sandboxRestricted = isSandboxDomainRestrictionError(error.message);
      if (sandboxRestricted) {
        logError(
          "auth",
          "Resend: dominio di test 'onboarding@resend.dev' non può consegnare email a utenti reali. " +
            "Verifica un dominio su resend.com/domains e imposta RESEND_FROM_EMAIL.",
        );
      }

      const { sendOpsAlert } = await import("@/app/_lib/ops-alert");
      await sendOpsAlert({
        subject: sandboxRestricted
          ? "Reset password: dominio email non verificato su Resend"
          : "Invio email di reset password fallito",
        details: {
          userEmail: input.email,
          resendError: error.message,
        },
        tag: "Auth Ops",
      });

      return { ok: false, error: "Invio email non riuscito" };
    }

    return { ok: true };
  } catch (error) {
    logError("auth", "Unexpected password reset email error", {
      message: error instanceof Error ? error.message : String(error),
    });

    const { sendOpsAlert } = await import("@/app/_lib/ops-alert");
    await sendOpsAlert({
      subject: "Invio email di reset password fallito (eccezione)",
      details: {
        userEmail: input.email,
        error: error instanceof Error ? error.message : String(error),
      },
      tag: "Auth Ops",
    });

    return { ok: false, error: "Invio email non riuscito" };
  }
}
