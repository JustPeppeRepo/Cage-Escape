"use client";

import { motion } from "framer-motion";

const TEAM = [
  {
    name: "Simona Scavo",
    role: "Fotografa e Videomaker",
    bio: "Fotografa per professione ma cimentata in CAGE come videomaker per i nostri social media.",
  },
  {
    name: "Giuseppe Aiello",
    role: "Web Developer",
    bio: "Creatore e gestore del sito web e della pubblicità di CAGE Escape Room.",
  },
] as const;

function AboutBlock({
  title,
  children,
  index,
  align = "left",
}: {
  title: string;
  children: React.ReactNode;
  index: number;
  align?: "left" | "right";
}) {
  const isRight = align === "right";

  return (
    <motion.section
      data-flow-anchor
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className={`relative z-10 max-w-xl ${isRight ? "ml-auto text-right" : "mr-auto text-left"}`}
    >
      <h2 className="font-heading text-2xl text-blood-bright sm:text-3xl">
        {title}
      </h2>
      <div
        className={`mt-5 space-y-4 text-base leading-relaxed text-bone/75 sm:text-lg ${
          isRight ? "*:ml-auto" : ""
        }`}
      >
        {children}
      </div>
    </motion.section>
  );
}

function FounderBlock({ index }: { index: number }) {
  return (
    <motion.section
      data-flow-anchor
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className="relative z-10 max-w-3xl"
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

function TeamBlock({ index }: { index: number }) {
  return (
    <motion.section
      data-flow-anchor
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className="relative z-10 ml-auto max-w-md"
    >
      <h2 className="font-heading text-right text-2xl text-blood-bright sm:text-3xl">
        Team
      </h2>

      <ul className="mt-6 grid grid-cols-[1fr_auto] gap-x-4 gap-y-6">
        {TEAM.map((member) => (
          <li key={member.name} className="contents">
            <div className="self-center text-right">
              <h3 className="font-heading text-base text-bone sm:text-lg">
                {member.name}
              </h3>
              <p className="mt-1 text-xs uppercase tracking-widest text-blood-bright/80">
                {member.role}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-bone/55">
                {member.bio}
              </p>
            </div>
            <div
              className="aspect-square w-16 shrink-0 self-center border border-dashed border-void-mist bg-void-deep sm:w-20"
              role="img"
              aria-label={`Foto di ${member.name} — da inserire`}
            >
              <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-bone/35">
                Foto
              </div>
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

export function AboutContent() {
  return (
    <div className="relative flex flex-col gap-16 sm:gap-24">
      <AboutBlock title="Missione" index={0} align="left">
        <p>
          CAGE nasce dal desiderio di trasformare le avventure che esistono nei
          film in esperienze che possano essere vissute in prima persona.
        </p>
        <p>
          Non vogliamo che i giocatori osservino una storia, vogliamo che la
          attraversino: esplorando, scoprendo, agendo, superando ostacoli e
          vivendo emozioni reali in condizioni di sicurezza.
        </p>
        <p>
          Per noi un&apos;avventura non è una sequenza di enigmi: è un viaggio
          fatto di scelte, fatica, tensione, scoperta e conquista.
        </p>
        <p>
          CAGE esiste per permettere alle persone di vivere ciò che normalmente
          possono soltanto immaginare e trasformare queste esperienze in
          ricordi difficili da dimenticare.
        </p>
      </AboutBlock>

      <AboutBlock title="Visione" index={1} align="right">
        <p>
          CAGE vuole diventare il luogo in cui sia possibile vivere avventure
          sempre più vicine a quelle che oggi esistono solo nell&apos;immaginazione.
        </p>
        <p>
          Dall&apos;esplorazione di una piramide perduta alla sopravvivenza in un
          bunker, fino a esperienze fisiche, immersive e sicure che
          ridefiniscano il concetto stesso di Escape room.
        </p>
        <p>
          L&apos;obiettivo finale non è costruire stanze. L&apos;obiettivo finale
          è costruire avventure.
        </p>
      </AboutBlock>

      <FounderBlock index={2} />

      <TeamBlock index={3} />
    </div>
  );
}
