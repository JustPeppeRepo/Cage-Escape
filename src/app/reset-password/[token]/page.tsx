/**
 * Alias reset password `/reset-password/[token]`
 *
 * @description Redirect al path canonico `/reset-password?token=...`.
 * @hooks redirect (next/navigation)
 */
import { redirect } from "next/navigation";

type ResetPasswordTokenPageProps = {
  params: Promise<{ token: string }>;
};
export default async function ResetPasswordTokenPage({
  params,
}: ResetPasswordTokenPageProps) {
  const { token } = await params;
  redirect(`/reset-password?token=${encodeURIComponent(token)}`);
}
