"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { prepareSignup, type AuthFormState } from "@/actions/auth";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/horror/auth/PasswordInput";

type SignupFormProps = {
  callbackUrl: string;
};

export function SignupForm({ callbackUrl }: SignupFormProps) {
  const [state, setState] = useState<AuthFormState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const prepared = await prepareSignup(null, formData);
      if (!prepared?.success || prepared.errors) {
        setState(prepared);
        return;
      }

      const username = String(formData.get("username") ?? "");
      const { error } = await authClient.signUp.email({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        name: username,
        username,
        phone: String(formData.get("phone") ?? ""),
      });

      if (error) {
        setState({
          errors: {
            email: [
              "Registrazione non riuscita. Verifica i dati o prova ad accedere.",
            ],
          },
        });
        return;
      }

      window.location.assign(prepared.callbackUrl ?? callbackUrl);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone ${
        state?.errors ? "animate-shake" : ""
      }`}
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} readOnly />

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Nome utente
        <input
          type="text"
          name="username"
          required
          minLength={2}
          maxLength={32}
          autoComplete="username"
          className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
        />
        {state?.errors?.username ? (
          <span className="text-sm text-blood-bright">
            {state.errors.username[0]}
          </span>
        ) : null}
      </label>

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
        Telefono
        <input
          type="tel"
          name="phone"
          required
          minLength={10}
          maxLength={20}
          autoComplete="tel"
          className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
        />
        {state?.errors?.phone ? (
          <span className="text-sm text-blood-bright">
            {state.errors.phone[0]}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm text-bone/80">
        Password
        <PasswordInput
          name="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
        {state?.errors?.password ? (
          <span className="text-sm text-blood-bright">
            {state.errors.password[0]}
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Registrazione in corso…" : "Registrati"}
      </button>

      <p className="text-center text-sm text-bone/60">
        Hai già un account?{" "}
        <Link href="/login" className="underline decoration-blood underline-offset-4">
          Accedi
        </Link>
      </p>
    </form>
  );
}
