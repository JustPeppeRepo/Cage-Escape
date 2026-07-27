/**
 * Manutenzione pubblica del sito — unico punto di controllo.
 *
 * Per riaprire il sito: imposta `desired` a `false`.
 * Attiva solo in produzione Vercel (`VERCEL_ENV === "production"`):
 * in locale e sulle preview puoi lavorare sul sito normale.
 */
const desired = true;

export const MAINTENANCE = {
  /** `true` = solo la pagina di manutenzione è raggiungibile (solo prod Vercel). */
  enabled: desired && process.env.VERCEL_ENV === "production",
  /** Path interno della pagina (la home pubblica resta `/` via rewrite). */
  path: "/manutenzione",
  brand: "Cage Escape Room",
  headline: "Sito in manutenzione",
  message: "Stiamo preparando l'esperienza. Torneremo presto.",
};
