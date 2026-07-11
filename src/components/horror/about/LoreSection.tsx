"use client";

import { motion } from "framer-motion";

type LoreSectionProps = {
  title: string;
  children: React.ReactNode;
  index: number;
};

export function LoreSection({ title, children, index }: LoreSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.05 }}
      className="border-l-2 border-blood/40 pl-6"
    >
      <h2 className="font-heading text-2xl text-blood-bright sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-bone/75 leading-relaxed">{children}</div>
    </motion.section>
  );
}
