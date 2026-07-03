"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/_actions/account";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone ${
        state && !state.success ? "animate-shake" : ""
      }`}
    >
      <p className="text-sm text-bone/70">
        Inserisci la tua email e ti invieremo un link per reimpostare la password.
      </p>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
        />
      </label>

      <AdminFormFeedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Invio in corso…" : "Invia link di reset"}
      </button>

      <p className="text-center text-sm text-bone/60">
        <Link href="/login" className="underline decoration-blood underline-offset-4">
          Torna al login
        </Link>
      </p>
    </form>
  );
}
