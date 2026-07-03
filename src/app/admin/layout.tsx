import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Difesa in profondita' a livello di shell. Per via del partial rendering
  // di Next.js questo controllo NON viene ripetuto ad ogni navigazione
  // client-side tra pagine sorelle sotto /admin: ogni page.tsx qui sotto
  // DEVE comunque richiamare autonomamente requireAdmin() (vedi Next.js
  // "Layouts and auth checks" nella guida authentication).
  await requireAdmin();

  return <>{children}</>;
}
