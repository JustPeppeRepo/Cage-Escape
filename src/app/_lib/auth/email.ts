import { logError } from "@/lib/logger";
import {
  getResendFromAddress,
  isSandboxDomainRestrictionError,
} from "@/app/_lib/email/shared";

type AuthEmailResult =
  | { ok: true }
  | { ok: false; error: string; skipped?: boolean };

async function sendAuthEmail(input: {
  email: string;
  subject: string;
  text: string;
  opsSubject: string;
  opsSubjectSandbox: string;
  logLabel: string;
}): Promise<AuthEmailResult> {
  const { env } = await import("@/app/_lib/env");

  if (!env.RESEND_API_KEY) {
    logError(
      "auth",
      `${input.logLabel} non configurata: RESEND_API_KEY mancante`,
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
      subject: input.subject,
      text: input.text,
    });

    if (error) {
      logError("auth", `Resend API error (${input.logLabel})`, {
        message: error.message,
      });

      // Senza un dominio verificato (RESEND_FROM_EMAIL), Resend rifiuta con
      // un 403 ogni invio verso un indirizzo diverso da quello del
      // proprietario dell'account: le email auth per utenti reali non
      // funzionerebbero MAI silenziosamente. Segnaliamo il caso in modo
      // esplicito nei log e avvisiamo lo staff.
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
          ? input.opsSubjectSandbox
          : input.opsSubject,
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
    logError("auth", `Unexpected ${input.logLabel} email error`, {
      message: error instanceof Error ? error.message : String(error),
    });

    const { sendOpsAlert } = await import("@/app/_lib/ops-alert");
    await sendOpsAlert({
      subject: `${input.opsSubject} (eccezione)`,
      details: {
        userEmail: input.email,
        error: error instanceof Error ? error.message : String(error),
      },
      tag: "Auth Ops",
    });

    return { ok: false, error: "Invio email non riuscito" };
  }
}

export async function sendPasswordResetEmail(input: {
  email: string;
  url: string;
}): Promise<AuthEmailResult> {
  return sendAuthEmail({
    email: input.email,
    subject: "Reimposta la password — Cage Room",
    text: [
      "Hai richiesto di reimpostare la password del tuo account Cage Room.",
      "",
      "Clicca sul link seguente per scegliere una nuova password:",
      input.url,
      "",
      "Se non hai richiesto tu questo messaggio, ignora questa email.",
    ].join("\n"),
    opsSubject: "Invio email di reset password fallito",
    opsSubjectSandbox:
      "Reset password: dominio email non verificato su Resend",
    logLabel: "password reset",
  });
}

export async function sendVerificationEmail(input: {
  email: string;
  url: string;
}): Promise<AuthEmailResult> {
  return sendAuthEmail({
    email: input.email,
    subject: "Verifica la tua email — Cage Room",
    text: [
      "Conferma il tuo account Cage Room cliccando sul link seguente:",
      input.url,
      "",
      "Se non hai creato tu questo account, ignora questa email.",
    ].join("\n"),
    opsSubject: "Invio email di verifica account fallito",
    opsSubjectSandbox:
      "Verifica email: dominio email non verificato su Resend",
    logLabel: "email verification",
  });
}
