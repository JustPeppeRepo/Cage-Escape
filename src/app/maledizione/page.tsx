import type { Metadata } from "next";
import Link from "next/link";
import { getMaledizionePageData } from "@/app/_actions/maledizione";
import { MaledizioneGame } from "@/components/horror/maledizione/MaledizioneGame";

export const metadata: Metadata = {
  title: "Il Rito della Maledizione | Cage Room",
  description:
    "Mini-gioco segreto: affronta l'enigma al buio e sblocca uno sconto sulla tua prossima prenotazione.",
  robots: { index: false, follow: false },
};

export default async function MaledizionePage() {
  const data = await getMaledizionePageData();

  return (
    <main className="min-h-screen bg-void px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-bone/50 hover:text-bone">
          ← Torna alla home
        </Link>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-blood-bright">
          Il Rito della Maledizione
        </h1>
        <p className="mt-4 text-bone/70">
          Pochi osano arrivare fin qui. Risolvi l&apos;enigma e otterrai un codice
          sconto — se il rito è ancora aperto.
        </p>

        <div className="mt-10">
          <MaledizioneGame {...data} />
        </div>
      </div>
    </main>
  );
}
