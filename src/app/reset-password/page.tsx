import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reimposta password | Cage Room",
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const invalidToken = error === "INVALID_TOKEN";

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-24 text-bone">
      <div className="w-full max-w-sm">
        <h2 className="mb-6 text-center font-heading text-3xl text-blood-bright">
          Reimposta password
        </h2>
        <ResetPasswordForm token={token ?? null} invalidToken={invalidToken} />
      </div>
    </main>
  );
}
