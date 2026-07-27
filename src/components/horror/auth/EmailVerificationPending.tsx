"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  resendVerificationEmail,
  type ResendVerificationState,
} from "@/actions/auth";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/auth-constants";

type EmailVerificationPendingProps = {
  email: string;
  callbackUrl: string;
  /** Testo introduttivo (signup vs login). */
  description: string;
  showLoginLink?: boolean;
  /** Torna al form di login senza ricaricare la pagina. */
  onBackToForm?: () => void;
};

export function EmailVerificationPending({
  email,
  callbackUrl,
  description,
  showLoginLink = false,
  onBackToForm,
}: EmailVerificationPendingProps) {
  const [cooldown, setCooldown] = useState(VERIFICATION_RESEND_COOLDOWN_SECONDS);
  const [resendState, setResendState] = useState<ResendVerificationState>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function onResend() {
    if (cooldown > 0 || pending) return;

    const formData = new FormData();
    formData.set("email", email);
    formData.set("callbackUrl", callbackUrl);

    startTransition(async () => {
      const result = await resendVerificationEmail(null, formData);
      setResendState(result);

      if (result?.retryAfterSeconds) {
        setCooldown(result.retryAfterSeconds);
        return;
      }

      if (result?.success) {
        setCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone">
      <h2 className="font-display text-xl text-bone">Controlla la tua email</h2>
      <p className="text-sm text-bone/80">{description}</p>
      <p className="text-sm text-bone/70">
        Inviata a{" "}
        <span className="font-medium text-bone">{email}</span>. Controlla anche
        la cartella spam.
      </p>

      {resendState?.success ? (
        <p className="text-sm text-bone/80" role="status">
          Email di verifica reinviata. Controlla di nuovo la casella.
        </p>
      ) : null}

      {resendState?.error ? (
        <p className="text-sm text-blood-bright" role="alert">
          {resendState.error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onResend}
        disabled={pending || cooldown > 0}
        className="rounded border border-void-mist bg-void px-4 py-2 text-bone transition-colors hover:border-blood hover:bg-void-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Invio in corso…"
          : cooldown > 0
            ? `Reinvia tra ${cooldown}s`
            : "Reinvia email di verifica"}
      </button>

      {showLoginLink ? (
        <Link
          href="/login"
          className="rounded bg-blood px-4 py-2 text-center text-bone transition-colors hover:bg-blood-bright"
        >
          Vai al login
        </Link>
      ) : (
        <p className="text-center text-sm text-bone/60">
          Hai già verificato?{" "}
          <button
            type="button"
            onClick={onBackToForm}
            className="underline decoration-blood underline-offset-4"
          >
            Riprova ad accedere
          </button>
        </p>
      )}
    </div>
  );
}
