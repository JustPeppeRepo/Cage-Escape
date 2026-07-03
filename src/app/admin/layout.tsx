import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/dal";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-void text-bone">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-56 shrink-0 md:block">
          <AdminNav />
        </aside>
        <div className="flex-1 px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
