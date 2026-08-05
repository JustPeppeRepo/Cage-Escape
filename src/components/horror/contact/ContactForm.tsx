"use client";

import { useActionState, useId } from "react";
import { submitContact } from "@/actions/contact";

const inputClassName =
  "rounded border border-void-mist bg-void px-3 py-2 text-bone w-full";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, null);
  const formId = useId();
  const nameErrorId = `${formId}-name-error`;
  const emailErrorId = `${formId}-email-error`;
  const messageErrorId = `${formId}-message-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.success ? (
        <p
          className="rounded border border-ectoplasm/30 bg-ectoplasm/10 px-3 py-2 text-sm text-ectoplasm"
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Nome
        <input
          name="name"
          required
          maxLength={100}
          className={inputClassName}
          aria-invalid={state?.errors?.name ? true : undefined}
          aria-describedby={state?.errors?.name ? nameErrorId : undefined}
        />
        {state?.errors?.name ? (
          <span id={nameErrorId} className="text-blood-bright" role="alert">
            {state.errors.name[0]}
          </span>
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
          aria-invalid={state?.errors?.email ? true : undefined}
          aria-describedby={state?.errors?.email ? emailErrorId : undefined}
        />
        {state?.errors?.email ? (
          <span id={emailErrorId} className="text-blood-bright" role="alert">
            {state.errors.email[0]}
          </span>
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
          aria-invalid={state?.errors?.message ? true : undefined}
          aria-describedby={state?.errors?.message ? messageErrorId : undefined}
        />
        {state?.errors?.message ? (
          <span id={messageErrorId} className="text-blood-bright" role="alert">
            {state.errors.message[0]}
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={pending || state?.success}
        aria-label={pending ? "Invio del messaggio in corso" : "Invia messaggio"}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Invio in corso…" : "Invia"}
      </button>
    </form>
  );
}
