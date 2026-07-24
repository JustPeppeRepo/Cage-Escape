"use client";

import { useActionState } from "react";
import { submitContact } from "@/actions/contact";

const inputClassName =
  "rounded border border-void-mist bg-void px-3 py-2 text-bone w-full";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.success ? (
        <p className="rounded border border-ectoplasm/30 bg-ectoplasm/10 px-3 py-2 text-sm text-ectoplasm">
          {state.message}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Nome
        <input name="name" required maxLength={100} className={inputClassName} />
        {state?.errors?.name ? (
          <span className="text-blood-bright">{state.errors.name[0]}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClassName}
        />
        {state?.errors?.email ? (
          <span className="text-blood-bright">{state.errors.email[0]}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Oggetto (opzionale)
        <input name="subject" maxLength={200} className={inputClassName} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Messaggio
        <textarea
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={5000}
          className={inputClassName}
        />
        {state?.errors?.message ? (
          <span className="text-blood-bright">{state.errors.message[0]}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={pending || state?.success}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Invio in corso…" : "Invia"}
      </button>
    </form>
  );
}
