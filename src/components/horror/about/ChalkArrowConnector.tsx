"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const VARIANTS = {
  /** Missione → Visione: tall S-wave (position overridden on lg via page wrapper) */
  longLtr: {
    src: "/about/chalk-arrow-missione-s.png",
    className:
      "-mt-6 ml-[min(14rem,40%)] h-64 w-52 max-w-[14rem] sm:-mt-8 sm:ml-[18rem] sm:h-72 sm:w-56",
    flip: false,
    drift: 1,
    duration: 5.4,
  },
  /** Visione → Fondatore: energetic flourish right to left */
  shortRtl: {
    src: "/about/chalk-arrow-short-rtl.png",
    className: "ml-auto mr-2 h-28 w-[75%] max-w-xl sm:mr-6 sm:h-40 sm:w-[68%]",
    flip: false,
    drift: -1,
    duration: 4.2,
  },
  /** Fondatore → Team: tall kinetic descent */
  tallDown: {
    src: "/about/chalk-arrow-tall-down.png",
    className: "mx-auto h-48 w-[80%] max-w-lg sm:h-64 sm:translate-x-12 sm:w-[70%]",
    flip: false,
    drift: 1,
    duration: 5.0,
  },
} as const;

export type ChalkArrowVariant = keyof typeof VARIANTS;

type ChalkArrowConnectorProps = {
  variant: ChalkArrowVariant;
  className?: string;
};

export function ChalkArrowConnector({
  variant,
  className = "",
}: ChalkArrowConnectorProps) {
  const config = VARIANTS[variant];

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
      className={`pointer-events-none relative ${config.className} ${className}`}
    >
      <motion.div
        className="absolute inset-0 origin-center"
        animate={{
          y: [0, 8 * config.drift, -3 * config.drift, 0],
          x: [0, 4 * config.drift, -2 * config.drift, 0],
          rotate: [0, 2.2 * config.drift, -1.1 * config.drift, 0],
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Image
          src={config.src}
          alt=""
          fill
          sizes="(max-width: 640px) 95vw, 800px"
          className={`object-contain opacity-75 ${
            config.flip ? "-scale-x-100" : ""
          }`}
          priority={false}
        />
      </motion.div>
    </motion.div>
  );
}
