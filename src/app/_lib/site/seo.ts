import { env } from "@/app/_lib/env";
import { SOCIAL_LINKS } from "@/app/_lib/site/social";

export const SITE_NAME = "Cage Escape Room";

export const SITE_DESCRIPTION =
  "Cage Escape Room: escape room immersive con temi diversi, dall'avventura all'horror. Prenota online e vivi 90 minuti di enigmi fuori dal mondo.";

export const SITE_KEYWORDS = [
  "escape room",
  "escape room Palermo",
  "Cage Escape Room",
  "escape room horror",
  "prenota escape room",
  "esperienza immersiva",
  "escape room Italia",
] as const;

export const SITE_OG_TITLE = "Cage Escape Room — Escape Room Immersive";

export const SITE_OG_DESCRIPTION =
  "Prenota la tua escape room da Cage Escape Room. Esperienze immersive a tema — anche horror — con enigmi e 90 minuti per uscirne.";

/** Contatti pubblici usati in JSON-LD e pagine. */
export const SITE_CONTACT = {
  telephone: "+393929375672",
  email: "info@cageroom.it",
  addressLocality: "Palermo",
  addressCountry: "IT",
} as const;

export function getSiteUrl(path = ""): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getSameAsLinks(): string[] {
  return SOCIAL_LINKS.map((link) => link.href);
}
