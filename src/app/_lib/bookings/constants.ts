export const DEFAULT_OPEN_HOUR = 10;
export const DEFAULT_CLOSE_HOUR = 22;
export const HOLD_DURATION_MS = 10 * 60 * 1000;
export const TIMEZONE = "Europe/Rome";
// Limite di hold PENDING attivi per singolo utente: senza questo cap un
// account autenticato potrebbe bloccare molti slot in parallelo per 10
// minuti ciascuno (il rate limit su holdSlot e' solo per-IP e per-minuto),
// negando disponibilita' ad altri utenti.
export const MAX_CONCURRENT_HOLDS_PER_USER = 2;
// Oltre questa soglia rispetto all'inizio dell'evento, l'annullamento
// self-service (con rimborso) non e' piu' consentito: l'utente deve
// contattare l'assistenza per eventuali eccezioni.
export const REFUND_CUTOFF_HOURS = 48;
