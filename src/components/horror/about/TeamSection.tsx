"use client";

import { motion } from "framer-motion";

type TeamSectionProps = {
  index?: number;
};

const TEAM = [
  {
    name: "Simona Scavo",
    role: "Ruolo",
    bio: "Breve descrizione placeholder del membro del team.",
  },
  {
    name: "Giuseppe Aiello",
    role: "Ruolo",
    bio: "Breve descrizione placeholder del membro del team.",
  },
] as const;

export function TeamSection({ index = 0 }: TeamSectionProps) {
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
