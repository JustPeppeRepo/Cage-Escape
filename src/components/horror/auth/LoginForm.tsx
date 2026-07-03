"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone ${
        state?.errors ? "animate-shake" : ""
      }`}
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} readOnly />

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
        />
        {state?.errors?.email ? (
          <span className="text-sm text-blood-bright">
            {state.errors.email[0]}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
        />
        {state?.errors?.password ? (
          <span className="text-sm text-blood-bright">
            {state.errors.password[0]}
          </span>
        ) : null}
      </label>

      <p className="text-right text-sm">
        <Link
          href="/forgot-password"
          className="text-bone/60 underline decoration-blood underline-offset-4 hover:text-bone"
        >
          Password dimenticata?
        </Link>
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Accesso in corso…" : "Accedi"}
      </button>

      <p className="text-center text-sm text-bone/60">
        Non hai un account?{" "}
        <Link href="/signup" className="underline decoration-blood underline-offset-4">
          Registrati
        </Link>
      </p>
    </form>
  );
}
