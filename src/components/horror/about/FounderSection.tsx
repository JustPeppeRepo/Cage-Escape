"use client";

import { motion } from "framer-motion";

type FounderSectionProps = {
  index?: number;
};

export function FounderSection({ index = 0 }: FounderSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className="max-w-3xl"
    >
      <h2 className="font-heading text-2xl text-blood-bright sm:text-3xl">
        Fondatore
      </h2>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div
          className="mx-auto aspect-3/4 w-full max-w-55 shrink-0 border border-dashed border-void-mist bg-void-deep sm:mx-0"
          role="img"
          aria-label="Foto professionale di Girolamo Emanuele Aiello — da inserire"
        >
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-bone/35">
            Foto
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-base leading-relaxed text-bone/75 sm:text-lg">
          <p className="font-heading text-xl text-bone sm:text-2xl">
            Girolamo Emanuele Aiello
          </p>
          <p>
            CAGE nasce dalla mia passione per il problem solving, il game design e
            le esperienze immersive.
          </p>
          <p>
            Credo che un&apos;escape room non debba limitarsi a proporre enigmi,
            ma debba trasportare i giocatori in un mondo credibile, dove ogni
            dettaglio contribuisce alla storia.
          </p>
          <p>
            Per questo progetto ogni esperienza è sviluppata seguendo un metodo
            preciso, sviluppato internamente e perfezionato nel tempo, con un
            unico obiettivo: far vivere emozioni che restino impresse anche dopo
            l&apos;uscita dalla stanza.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
