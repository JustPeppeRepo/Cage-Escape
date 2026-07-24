"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ABOUT_ARROW_ART,
  ARROW_ART_END,
  ARROW_ART_START,
  type HandDrawnArrowArt,
} from "@/components/horror/about/aboutArrowArt";

/** Provvisorio: spegni le frecce senza togliere il layout/sezioni. */
const ARROWS_ENABLED = false;

type Point = { x: number; y: number };

type PlacedArrow = {
  art: HandDrawnArrowArt;
  transform: string;
};

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

function rel(rect: DOMRect, origin: DOMRect): Box {
  return {
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    top: rect.top - origin.top,
    bottom: rect.bottom - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

/** Maps hand-drawn START→END onto live from→to (uniform scale + rotate). */
function artTransform(from: Point, to: Point): string {
  const sx = ARROW_ART_START.x;
  const sy = ARROW_ART_START.y;
  const ex = ARROW_ART_END.x;
  const ey = ARROW_ART_END.y;

  const artDx = ex - sx;
  const artDy = ey - sy;
  const artLen = Math.hypot(artDx, artDy) || 1;

  const liveDx = to.x - from.x;
  const liveDy = to.y - from.y;
  const liveLen = Math.hypot(liveDx, liveDy) || 1;

  const scale = liveLen / artLen;
  const artAngle = (Math.atan2(artDy, artDx) * 180) / Math.PI;
  const liveAngle = (Math.atan2(liveDy, liveDx) * 180) / Math.PI;
  const rotate = liveAngle - artAngle;

  return [
    `translate(${from.x.toFixed(2)} ${from.y.toFixed(2)})`,
    `rotate(${rotate.toFixed(3)})`,
    `scale(${scale.toFixed(5)})`,
    `translate(${(-sx).toFixed(2)} ${(-sy).toFixed(2)})`,
  ].join(" ");
}

function buildArrows(
  container: HTMLElement,
  sections: HTMLElement[],
): PlacedArrow[] {
  const origin = container.getBoundingClientRect();
  if (sections.length < 4) return [];

  const [missione, visione, fondatore, team] = sections.map((el) =>
    rel(el.getBoundingClientRect(), origin),
  );

  const anchors: Record<HandDrawnArrowArt["id"], { from: Point; to: Point }> = {
    "missione-visione": {
      from: { x: missione.right + 22, y: missione.bottom + 6 },
      to: { x: visione.left - 20, y: visione.top - 8 },
    },
    "visione-fondatore": {
      from: { x: visione.left - 20, y: visione.bottom + 6 },
      to: { x: fondatore.left + 48, y: fondatore.top - 18 },
    },
    "fondatore-team": {
      from: {
        x: fondatore.left + fondatore.width * 0.62,
        y: fondatore.bottom + 18,
      },
      to: { x: team.left - 20, y: team.top - 6 },
    },
  };

  return ABOUT_ARROW_ART.map((art) => {
    const { from, to } = anchors[art.id];
    return { art, transform: artTransform(from, to) };
  });
}

type AboutFlowArrowsProps = {
  children: ReactNode;
};

export function AboutFlowArrows({ children }: AboutFlowArrowsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<PlacedArrow[]>([]);

  useEffect(() => {
    if (!ARROWS_ENABLED) return;

    const container = containerRef.current;
    if (!container) return;

    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia("(max-width: 1023px)").matches) {
          setArrows([]);
          return;
        }
        const sections = Array.from(
          container.querySelectorAll<HTMLElement>("[data-flow-anchor]"),
        );
        if (sections.length < 2) {
          setArrows([]);
          return;
        }
        setArrows(buildArrows(container, sections));
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);

    const mo = new MutationObserver(() => {
      for (const el of container.querySelectorAll("[data-flow-anchor]")) {
        ro.observe(el);
      }
      measure();
    });
    mo.observe(container, { childList: true, subtree: true });

    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", measure);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-16 sm:gap-24"
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 hidden overflow-visible lg:block"
        width="100%"
        height="100%"
      >
        {ARROWS_ENABLED
          ? arrows.map(({ art, transform }, i) => (
          <g key={art.id} transform={transform}>
            {art.soft ? (
              <motion.path
                d={art.d}
                fill="none"
                stroke={art.color}
                strokeWidth={art.soft.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{
                  pathLength: 1,
                  opacity: art.soft.opacity,
                }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 1.2,
                  delay: 0.1 + i * 0.22,
                  ease: "easeOut",
                }}
              />
            ) : null}
            <motion.path
              d={art.d}
              fill="none"
              stroke={art.color}
              strokeWidth={art.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.78 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 1.35,
                delay: 0.08 + i * 0.22,
                ease: "easeOut",
              }}
            />
            <motion.path
              d={art.head}
              fill="none"
              stroke={art.color}
              strokeWidth={art.width + 0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.85 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: 1.15 + i * 0.22 }}
            />
            {art.extras?.map((extra, j) => (
              <motion.path
                key={j}
                d={extra}
                fill="none"
                stroke={art.color}
                strokeWidth={Math.max(1.2, art.width - 0.6)}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.55 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 1.2,
                  delay: 0.2 + i * 0.22,
                  ease: "easeOut",
                }}
              />
            ))}
          </g>
        ))
          : null}
      </svg>

      {children}
    </div>
  );
}
