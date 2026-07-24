/**
 * Path delle frecce /about (viewBox art 0 0 400 300).
 * START (40,40) → END (360,260). La V della punta è in `head`.
 */

export type HandDrawnArrowArt = {
  id: "missione-visione" | "visione-fondatore" | "fondatore-team";
  d: string;
  /** Punta a V (coordinate art, tip ≈ END) */
  head: string;
  extras?: string[];
  color: string;
  width: number;
  soft?: { width: number; opacity: number };
};

export const ARROW_ART_START = { x: 40, y: 40 };
export const ARROW_ART_END = { x: 360, y: 260 };

/** V aperta con tip in (360,260), leggero tilt “a mano” */
const HEAD_V = "M 342 246 L 360 260 L 348 276";

export const ABOUT_ARROW_ART: HandDrawnArrowArt[] = [
  {
    id: "missione-visione",
    // Curve dolci: sale a destra, rientra, poi scende verso l’END
    d: "M40 40 C 100 48, 170 55, 230 85 C 290 115, 330 150, 310 185 C 290 220, 320 245, 360 260",
    head: HEAD_V,
    color: "#E8B4B8",
    width: 2.5,
    soft: { width: 6.5, opacity: 0.15 },
  },
  {
    id: "visione-fondatore",
    // Stesso linguaggio dell’ultima: meandro morbido a sinistra, poi verso END
    d: "M40 40 C 20 85, 55 130, 75 165 C 100 210, 180 205, 255 220 C 310 232, 340 248, 360 260",
    head: HEAD_V,
    color: "#A8D5C5",
    width: 2.25,
    soft: { width: 5.2, opacity: 0.12 },
  },
  {
    id: "fondatore-team",
    d: "M40 40 C 100 80, 30 140, 90 180 C 150 220, 280 200, 320 230 C 340 245, 350 255, 360 260",
    head: HEAD_V,
    color: "#C9B8E8",
    width: 2.7,
    soft: { width: 1.35, opacity: 0.5 },
  },
];
