"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FogOverlay } from "@/components/horror/FogOverlay";

export function HeroClient() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-void-deep px-6 text-center">
      <FogOverlay />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="animate-flicker font-[family-name:var(--font-display)] text-5xl text-blood-bright sm:text-7xl"
        >
          Riuscirai a uscirne vivo?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="max-w-xl text-lg text-bone/80"
        >
          90 minuti. Nessuna via di fuga facile. Solo chi conserva la lucidità
          esce dal Manicomio prima che la mezzanotte lo reclami.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Link
            href="/rooms"
            className="hover:animate-glitch-hover inline-block rounded-sm border-2 border-blood bg-blood/20 px-10 py-4 text-lg font-semibold uppercase tracking-widest text-bone shadow-[0_0_25px_rgba(153,0,0,0.5)] transition-colors hover:bg-blood/40"
          >
            Prenota se hai coraggio
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
