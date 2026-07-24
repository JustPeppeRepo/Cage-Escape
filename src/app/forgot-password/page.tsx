import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Password dimenticata",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-24 text-bone">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-heading text-3xl text-blood-bright">
          Password dimenticata
        </h1>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
