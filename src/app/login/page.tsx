import type { Metadata } from "next";
import { LoginForm } from "@/components/horror/auth/LoginForm";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Accedi | Cage Room",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-24 text-bone">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-heading text-3xl text-blood-bright">
          Accedi
        </h1>
        <LoginForm callbackUrl={safeCallbackUrl} />
      </div>
    </main>
  );
}
