import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function HomeBookingCta() {
  return (
    <section className="bg-void-deep py-16 sm:py-24">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <SectionHeading eyebrow="Il tuo turno" title="Prenota l'esperienza" />
        <p className="max-w-lg text-base text-bone/70 sm:text-lg">
          Scegli la stanza, prenota online e preparati a entrare. Non resta
          altro da fare — se non avere il coraggio di aprirla.
        </p>
        <Link
          href="/rooms"
          className="hero-cta-pulse inline-block rounded-sm border-2 border-blood-bright bg-blood px-8 py-4 font-heading text-lg tracking-widest text-bone transition-colors hover:bg-blood-bright sm:px-12 sm:py-5 sm:text-xl"
        >
          <span className="hero-cta-label inline-block">Vai alle stanze</span>
        </Link>
      </div>
    </section>
  );
}
