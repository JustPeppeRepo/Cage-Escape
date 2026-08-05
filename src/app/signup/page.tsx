/**
 * Registrazione `/signup`
 *
 * @description Creazione account; callbackUrl sanificato.
 * @components SignupForm → prepareSignup, authClient.signUp
 * @utils sanitizeCallbackUrl
 * @seo noindex
 */
import type { Metadata } from "next";
import { SignupForm } from "@/components/horror/auth/SignupForm";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Registrati",
  robots: { index: false, follow: false },
};

type SignupPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-24 text-bone">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-heading text-3xl text-blood-bright">
          Crea un account
        </h1>
        <SignupForm callbackUrl={safeCallbackUrl} />
      </div>
    </main>
  );
}
