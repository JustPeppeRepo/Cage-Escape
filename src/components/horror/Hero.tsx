import Link from "next/link";
import { FogOverlay } from "@/components/horror/FogOverlay";
import { HeroVideo } from "@/components/horror/HeroVideo";

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-void-deep px-6 text-center">
      <HeroVideo />
      <FogOverlay />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(130vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl sm:w-[min(90vw,48rem)]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(3,3,3,0.78) 0%, rgba(3,3,3,0.4) 25%, rgba(3,3,3,0.15) 45%, transparent 62%)",
          }}
        />

        <h2 className="relative font-heading text-5xl text-blood-bright sm:text-7xl">
          Riuscirai a uscirne vivo?
        </h2>

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
            className="animate-glitch-soft hover:animate-glitch-hover inline-block rounded bg-blood px-6 py-3 text-base font-semibold uppercase tracking-widest text-bone transition-colors hover:bg-blood-bright sm:px-10 sm:py-4 sm:text-lg"
          >
            Prenota l&apos;esperienza
          </Link>
        </div>
      </div>
    </section>
  );
}
