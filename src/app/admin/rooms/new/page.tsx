import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { RoomForm } from "@/components/admin/RoomForm";

export const metadata: Metadata = {
  title: "Nuova stanza | Admin | Cage Room",
  robots: { index: false, follow: false },
};

export default async function AdminNewRoomPage() {
  await requireAdmin();

  return (
    <main>
      <Link href="/admin/rooms" className="text-sm text-bone/60 hover:text-bone">
        ← Torna alle stanze
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-blood-bright">
        Nuova stanza
      </h1>
      <div className="mt-8 max-w-2xl">
        <RoomForm />
      </div>
    </main>
  );
}
