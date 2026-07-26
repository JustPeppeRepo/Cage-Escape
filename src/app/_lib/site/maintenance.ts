/**
 * Manutenzione pubblica del sito — unico punto di controllo.
 *
 * Per riaprire il sito: imposta `enabled` a `false`.
 * Testi e path della pagina si modificano solo qui.
 */
export const MAINTENANCE = {
  /** `true` = solo la pagina di manutenzione è raggiungibile. */
  enabled: true,
  /** Path interno della pagina (la home pubblica resta `/` via rewrite). */
  path: "/manutenzione",
  brand: "Cage Escape Room",
  headline: "Sito in manutenzione",
  message: "Stiamo preparando l'esperienza. Torneremo presto.",
} as const;
