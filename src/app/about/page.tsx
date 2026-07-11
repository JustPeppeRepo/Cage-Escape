import type { Metadata } from "next";
import Link from "next/link";
import { LoreSection } from "@/components/horror/about/LoreSection";

export const metadata: Metadata = {
  title: "Chi siamo | Cage Room",
  description:
    "La storia oscura dietro Cage Room: manicomio abbandonato, diari perduti e enigmi che non dovresti risolvere.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-bone/50 hover:text-bone">
          ← Torna alla home
        </Link>

        <header className="mt-8 mb-16">
          <p className="text-sm uppercase tracking-widest text-blood/80">
            La nostra storia
          </p>
          <h1 className="mt-4 font-heading text-4xl text-blood-bright sm:text-5xl">
            Chi siamo
          </h1>
          <p className="mt-6 text-lg text-bone/70">
            Cage Room non è un&apos;escape room come le altre. È ciò che resta quando
            qualcuno ha deciso che il terrore potesse essere un&apos;esperienza
            vendibile.
          </p>
        </header>

        <div className="flex flex-col gap-16">
          <LoreSection title="Origini nel buio" index={0}>
            <p>
              Tutto iniziò con un manicomio fuori città, chiuso negli anni &apos;80
              dopo una serie di incidenti mai spiegati del tutto. I locali furono
              sigillati, i registri bruciati, le voci sussurrate.
            </p>
            <p>
              Noi abbiamo solo riaperto le porte — e aggiunto qualche enigma in
              più, per chi crede di essere abbastanza lucido da uscirne vivo.
            </p>
          </LoreSection>

          <LoreSection title="I diari" index={1}>
            <p>
              Durante i lavori di restauro sono emersi quaderni scritti a mano:
              appunti di infermieri, schemi di corridoio, nomi barrati. Alcune
              pagine finiscono a metà frase, come se lo scrittore fosse stato
              interrotto.
            </p>
            <p>
              Quelle pagine hanno ispirato le stanze che vedete oggi. Non le
              abbiamo inventate noi. Le abbiamo solo messe in scena.
            </p>
          </LoreSection>

          <LoreSection title="Il nostro impegno" index={2}>
            <p>
              Ogni sessione è seguita da un Game Master addestrato. Il terrore è
              reale, ma controllato: nessuno resta solo, nessuno è in pericolo
              fisico. Solo psicologico — se ci credete.
            </p>
            <p>
              Prenotate online in pochi minuti. Il resto lo gestiamo noi, finché
              non suona la campana dei novanta minuti.
            </p>
          </LoreSection>
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/rooms"
            className="inline-block rounded bg-blood px-8 py-3 text-bone transition-colors hover:bg-blood-bright animate-glitch-hover"
          >
            Scegli la tua stanza
          </Link>
        </div>
      </div>
    </main>
  );
}
