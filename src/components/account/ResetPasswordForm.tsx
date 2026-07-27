"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/_actions/account";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { PasswordInput } from "@/components/horror/auth/PasswordInput";

type ResetPasswordFormProps = {
  token: string | null;
  invalidToken: boolean;
};

export function ResetPasswordForm({
  token,
  invalidToken,
}: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(resetPassword, null);

  if (invalidToken || !token) {
    return (
      <div className="rounded-md border border-blood/40 bg-blood/10 p-6 text-bone">
        <p className="text-sm text-blood-bright">
          Link non valido o scaduto. Richiedi un nuovo reset della password.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            className="underline decoration-blood underline-offset-4"
          >
            Richiedi nuovo link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone ${
        state && !state.success ? "animate-shake" : ""
      }`}
    >
      <input type="hidden" name="token" value={token} readOnly />

      <p className="text-sm text-bone/70">
        Scegli una nuova password per il tuo account (minimo 8 caratteri).
      </p>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Nuova password
        <PasswordInput
          name="newPassword"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Conferma password
        <PasswordInput
          name="confirmPassword"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </label>

      <AdminFormFeedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Salvataggio…" : "Imposta nuova password"}
      </button>

      <p className="text-center text-sm text-bone/60">
        <Link
          href="/login"
          className="underline decoration-blood underline-offset-4"
        >
          Torna al login
        </Link>
      </p>
    </form>
  );
}
