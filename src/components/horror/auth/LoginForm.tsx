"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  prepareLogin,
  type AuthFormState,
} from "@/actions/auth";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/horror/auth/PasswordInput";
import { EmailVerificationPending } from "@/components/horror/auth/EmailVerificationPending";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [state, setState] = useState<AuthFormState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const prepared = await prepareLogin(null, formData);
      if (!prepared?.success || prepared.errors) {
        setState(prepared);
        return;
      }

      const email = String(formData.get("email") ?? "").trim();
      const resolvedCallback = prepared.callbackUrl ?? callbackUrl;

      const { error } = await authClient.signIn.email({
        email,
        password: String(formData.get("password") ?? ""),
        callbackURL: resolvedCallback,
      });

      if (error) {
        // Email non verificata: Better Auth risponde 403 e (con sendOnSignIn)
        // ha già tentato l'invio nel medesimo POST. Non rifare subito un
        // secondo invio qui: rischia rate-limit e doppio traffico Resend.
        // Il reinvio resta sul pulsante in EmailVerificationPending.
        const unverified =
          error.status === 403 ||
          error.code === "EMAIL_NOT_VERIFIED" ||
          /email not verified/i.test(error.message ?? "");

        if (unverified) {
          setState({
            needsEmailVerification: true,
            verificationEmail: email,
            callbackUrl: resolvedCallback,
          });
          return;
        }

        if (error.status === 500) {
          setState({
            errors: {
              email: [
                "Impossibile inviare l'email di verifica. Riprova più tardi o contatta lo staff.",
              ],
            },
          });
          return;
        }

        setState({ errors: { email: ["Credenziali non valide"] } });
        return;
      }

      window.location.assign(resolvedCallback);
    });
  }

  if (state?.needsEmailVerification && state.verificationEmail) {
    return (
      <EmailVerificationPending
        email={state.verificationEmail}
        callbackUrl={state.callbackUrl ?? callbackUrl}
        description="Il tuo account esiste ma l'email non è ancora verificata. Ti abbiamo inviato un link di conferma: aprilo per attivare l'accesso, poi riprova ad entrare."
        onBackToForm={() => setState(null)}
      />
    );
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
        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
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
