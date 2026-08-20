"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PasswordInput } from "@/components/horror/auth/PasswordInput";

type SignupFormProps = {
  callbackUrl: string;
};

type SignupFormState = {
  errors?: {
    email?: string[];
    password?: string[];
    username?: string[];
    phone?: string[];
  };
  success?: boolean;
  needsEmailVerification?: boolean;
} | null;

export function SignupForm({ callbackUrl }: SignupFormProps) {
  const [state, setState] = useState<SignupFormState>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const username = String(formData.get("username") ?? "");
      const phone = String(formData.get("phone") ?? "");

      // Basic client-side validation
      if (!email || !password || !username || !phone) {
        setState({ errors: { email: ["Tutti i campi sono obbligatori"] } });
        return;
      }

      if (password.length < 8) {
        setState({ errors: { password: ["La password deve avere almeno 8 caratteri"] } });
        return;
      }

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth sign up
      // signUp automatically sends email confirmation if configured
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            phone,
            name: username, // Use username as display name
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      });

      if (error) {
        console.error("Signup error:", error);

        // Handle specific Supabase Auth error cases
        switch (error.message) {
          case "User already registered":
            setState({ 
              errors: { 
                email: ["Email già registrata. Prova ad accedere o usa il recupero password."] 
              } 
            });
            break;
          case "Password should be at least 6 characters":
            setState({ 
              errors: { 
                password: ["La password deve avere almeno 8 caratteri"] 
              } 
            });
            break;
          default:
            setState({
              errors: {
                email: [
                  "Registrazione non riuscita. Verifica i dati o prova ad accedere.",
                ],
              },
            });
        }
        return;
      }

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Successful signup
      // Show email verification message
      setState({
        success: true,
        needsEmailVerification: true,
      });
    });
  }

  if (state?.needsEmailVerification) {
    return (
      <div className="flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-bone mb-2">Verifica la tua email</h2>
          <p className="text-bone/80">
            Ti abbiamo inviato un link per verificare l'account. Apri la casella di posta, 
            conferma l'indirizzo e poi potrai accedere.
          </p>
        </div>
        <div className="text-center">
          <Link
            href="/login"
            className="text-bone/60 underline decoration-blood underline-offset-4 hover:text-bone"
          >
            Torna al login
          </Link>
        </div>
      </div>
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
