"use client";

import { motion } from "framer-motion";

type TeamSectionProps = {
  index?: number;
};

export function TeamSection({ index = 0 }: TeamSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className="ml-auto max-w-md"
    >
      <h2 className="font-heading text-2xl text-blood-bright sm:text-right sm:text-3xl">
        Team
      </h2>

      <ul className="mt-6 space-y-4">
        <li className="flex items-center gap-4 sm:justify-end">
          <div
            className="aspect-square w-16 shrink-0 border border-dashed border-void-mist bg-void-deep sm:w-20"
            role="img"
            aria-label="Foto membro del team — da inserire"
          >
            <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-bone/35">
              Foto
            </div>
          </div>
          <p className="text-sm uppercase tracking-widest text-bone/45 sm:text-base">
            Nome
          </p>
        </li>
      </ul>
    </motion.section>
  );
}
