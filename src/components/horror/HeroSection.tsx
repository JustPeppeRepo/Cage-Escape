import Link from "next/link";
import { HeroVideo } from "@/components/horror/HeroVideo";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-void-deep px-6 text-center">
      <HeroVideo />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="animate-fog-drift absolute left-1/2 top-1/3 h-64 w-[min(90%,28rem)] -translate-x-1/2 rounded-full bg-void-mist/40 blur-3xl sm:w-[min(80%,32rem)]" />
        <div
          className="animate-fog-drift absolute left-1/2 top-1/2 h-72 w-[min(95%,32rem)] -translate-x-1/2 rounded-full bg-void-mist/25 blur-3xl sm:w-[min(85%,36rem)]"
          style={{ animationDelay: "-9s" }}
        />
      </div>

      <div className="relative z-10 flex max-w-3xl flex-col items-center">
        <div className="-translate-y-8 flex flex-col items-center gap-4 sm:-translate-y-10 sm:gap-5">
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
        </div>

        <div className="hero-cta relative mt-5 sm:mt-6">
          <Link
            href="/rooms"
            className="hero-cta-pulse inline-block rounded-sm border-2 border-blood-bright bg-blood px-8 py-4 font-heading text-lg tracking-widest text-bone transition-colors hover:bg-blood-bright sm:px-12 sm:py-5 sm:text-xl"
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
