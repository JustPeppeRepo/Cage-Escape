import Link from "next/link";
import { FogOverlay } from "@/components/horror/FogOverlay";
import { HeroVideo } from "@/components/horror/HeroVideo";

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-void-deep px-6 text-center">
      <HeroVideo />
      <FogOverlay />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        <h1 className="relative font-heading text-5xl text-blood-bright sm:text-7xl">
          Riuscirai a uscirne vivo?
        </h1>

        <p className="hero-subtitle relative max-w-xl text-lg text-bone/80">
          Non sei qui per guardare una storia.
          <br />
          Non sei qui per seguire un copione.
          <br />
          Esplora. Decidi. Agisci.
          <br />
          E scopri cosa sei disposto a fare quando non puoi più tornare
          indietro
        </p>

        <div className="hero-cta relative">
          <Link
            href="/rooms"
            className="hero-cta-pulse inline-block rounded-sm border-2 border-bone bg-bone px-8 py-4 font-heading text-lg tracking-widest text-void-deep shadow-[0_0_28px_rgba(232,226,214,0.35)] transition-colors hover:bg-white hover:text-void sm:px-12 sm:py-5 sm:text-xl"
          >
            <span className="hero-cta-label inline-block">
              Prenota l&apos;esperienza
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
