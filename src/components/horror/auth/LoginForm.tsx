"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PasswordInput } from "@/components/horror/auth/PasswordInput";

type LoginFormProps = {
  callbackUrl: string;
};

type LoginFormState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
} | null;

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [state, setState] = useState<LoginFormState>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");

      // Basic client-side validation
      if (!email || !password) {
        setState({ errors: { email: ["Email e password sono obbligatori"] } });
        return;
      }

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth sign in with rate limiting
      // signInWithPassword handles server-side validation and returns proper error codes
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);

        // Handle specific Supabase Auth error cases
        switch (error.message) {
          case "Invalid login credentials":
            setState({ errors: { email: ["Credenziali non valide"] } });
            break;
          case "Email not confirmed":
            setState({ 
              errors: { 
                email: ["Email non verificata. Controlla la tua casella di posta per il link di conferma."] 
              } 
            });
            break;
          case "Too many requests":
            setState({ 
              errors: { 
                email: ["Troppi tentativi. Riprova tra poco."] 
              } 
            });
            break;
          default:
            setState({ 
              errors: { 
                email: ["Accesso non riuscito. Riprova tra poco."] 
              } 
            });
        }
        return;
      }

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Successful authentication
      // Redirect to callback URL after successful authentication
      router.push(callbackUrl);
      router.refresh(); // Ensure middleware picks up the new session
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
          href="/reset-password"
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
