import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Amministrazione | Cage Room",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // Controllo indipendente da quello nel layout: e' questo, non quello nel
  // layout, a garantire la protezione ad ogni navigazione (vedi commento in
  // admin/layout.tsx).
  const session = await requireAdmin();

  return (
    <main className="min-h-screen bg-void px-6 py-24 text-bone">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-blood-bright">
          Pannello amministrazione
        </h1>
        <p className="mt-4 text-bone/70">
          Bentornato, {session.user.name}. La gestione di stanze, orari e
          prenotazioni sarà disponibile in una fase successiva.
        </p>
      </div>
    </main>
  );
}
