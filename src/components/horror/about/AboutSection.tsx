"use client";

import { motion } from "framer-motion";

type AboutSectionProps = {
  title: string;
  children: React.ReactNode;
  index: number;
  align?: "left" | "right";
  className?: string;
};

export function AboutSection({
  title,
  children,
  index,
  align = "left",
  className = "",
}: AboutSectionProps) {
  const isRight = align === "right";

  return (
    <motion.section
      data-flow-anchor
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: index * 0.06 }}
      className={`relative z-10 max-w-xl ${isRight ? "ml-auto text-right" : "mr-auto text-left"} ${className}`}
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
