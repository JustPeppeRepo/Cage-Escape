import { redirect } from "next/navigation";

type ResetPasswordTokenPageProps = {
  params: Promise<{ token: string }>;
};

/**
 * Fallback per link nel formato `/reset-password/<token>`.
 * Il path canonico (e quello inviato nelle email) è `/reset-password?token=...`.
 */
export default async function ResetPasswordTokenPage({
  params,
}: ResetPasswordTokenPageProps) {
  const { token } = await params;
  redirect(`/reset-password?token=${encodeURIComponent(token)}`);
}
