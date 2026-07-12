import Link from "next/link";
import { FogOverlay } from "@/components/horror/FogOverlay";

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-void-deep px-6 text-center">
      <FogOverlay />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        <h1 className="font-heading text-5xl text-blood-bright sm:text-7xl">
          Riuscirai a uscirne vivo?
        </h1>

        <p className="hero-subtitle max-w-xl text-lg text-bone/80">
          90 minuti. Nessuna via di fuga facile. Solo chi conserva la lucidità
          esce dal Manicomio prima che la mezzanotte lo reclami.
        </p>

        <div className="hero-cta">
          <Link
            href="/rooms"
            className="hover:animate-glitch-hover inline-block rounded-sm border-2 border-blood bg-blood/20 px-6 py-3 text-base font-semibold uppercase tracking-widest text-bone shadow-[0_0_25px_rgba(153,0,0,0.5)] transition-colors hover:bg-blood/40 sm:px-10 sm:py-4 sm:text-lg"
          >
            Prenota se hai coraggio
          </Link>
        </div>
      </div>
    </section>
  );
}
