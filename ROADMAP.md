# Roadmap — Cage Room

Documento vivo: aggiornato al completamento del piano Admin + pagine pubbliche + easter egg.

## Stato attuale (riepilogo — già fatto, non ritoccare)

- [x] Auth: Better Auth (login/signup, cookie/session server-side via `src/lib/dal.ts`, `trustedOrigins`)
- [x] Home page: hero cinematico, nebbia animata, card stanze da Prisma, teschi terrore, recensioni polaroid da DB, FAQ accordion, JSON-LD `LocalBusiness`, `JumpScare.tsx`, footer con dettagli nascosti
- [x] Listing e dettaglio stanze (`/rooms`, `/rooms/[slug]`) con calendario e booking widget (+ campo codice sconto)
- [x] Checkout con countdown hold (`/checkout?bookingId=`), polling stato pagamento
- [x] Stripe Checkout + webhook con verifica firma, controllo importo/valuta/metadata, gestione pagamenti duplicati, stato `PAYMENT_CONFLICT_REFUND_REQUIRED`, sconto easter egg
- [x] Prevenzione doppie prenotazioni: transazioni `Serializable` + vincolo `EXCLUDE` a DB
- [x] Rilascio automatico hold scaduti (`releaseExpiredHolds`) + cap prenotazioni pendenti per utente
- [x] Rate limiting su login, signup, contact, holdSlot, createStripeCheckoutSession, generateDiscountCode
- [x] Validazione Zod su tutte le Server Action; nessun calcolo prezzo lato client
- [x] Due round di security review (open redirect, enumerazione utenti, ecc.)
- [x] Pannello Admin completo (`/admin`, rooms, schedule, bookings, impostazioni)
- [x] Pagine `/about`, `/contatti`, `/maledizione`
- [x] Navbar pubblica con sessione server-side (link, login/logout, info utente)

## Fase A — Pannello Admin ✅

- [x] `/admin/rooms`: CRUD stanze + tier di prezzo
- [x] `/admin/schedule`: CRUD `ScheduleOverride`
- [x] `/admin/bookings`: elenco, filtri, annullamento, evidenza conflitti pagamento
- [x] `/admin/impostazioni`: `SiteSettings` (sconto easter egg on/off + percentuale)
- [x] Dashboard overview in `/admin`

## Fase B — Pagine pubbliche ✅

- [x] `/about`
- [x] `/contatti` + `ContactMessage` + Resend (env opzionali: `RESEND_API_KEY`, `CONTACT_EMAIL_TO`)
- [x] Footer con dettagli nascosti

## Fase C — Easter Egg ✅

- [x] `/maledizione` + `DiscountCode` + redemption server-side da `SiteSettings`

## Fase D — Rifiniture ✅

- [x] Shake su errori login/signup
- [x] `src/lib/logger.ts`
- [x] Tipi consolidati in `src/types/`
- [x] `.env.example`
- [x] Navbar pubblica con link alle pagine, stato login e info utente (`SiteNav` + sessione server-side)
- [x] Recensioni homepage da DB con CRUD admin (`/admin/reviews`)

## Fase E — Area utente e recupero password ✅

- [x] `/account`: profilo con avatar predefiniti, ordini, cambio password, eliminazione account
- [x] Recupero password: `/forgot-password`, `/reset-password`, link da login
- [x] Email reset via Resend (opzionale, come contatti)
- [x] Navbar: link «Il mio account» per utenti loggati
- [x] Blocco eliminazione account con prenotazioni attive o pagate

## Fase F — Sicurezza pagamenti e policy di rimborso ✅

- [x] Rate limiting distribuito (Upstash Redis) con fallback in-memory in sviluppo
- [x] Riserva atomica del codice sconto (indice unico parziale su `Booking.discountCodeId`) + guardia webhook
- [x] Refund Stripe obbligatorio nell'annullamento admin, incluso per `PAYMENT_CONFLICT_REFUND_REQUIRED`
- [x] `customRules` Better Auth su endpoint sensibili + lockout account su tentativi di login falliti
- [x] Alert operativi via email per ogni conflitto di pagamento rilevato dal webhook
- [x] Rimozione della feature experimental `authInterrupts` (sostituita con `notFound()` stabile)
- [x] Ogni ramo `PAYMENT_CONFLICT_REFUND_REQUIRED` del webhook registra sempre una riga `Payment` tracciabile
- [x] Annullamento self-service utente (`/account`) con rimborso automatico Stripe se effettuato oltre 48h prima dell'evento; bloccato entro le 48h (idempotency key, claim atomico anti-race, revert su fallimento rimborso)


- In caso di conflitto col prompt architetturale, vince lo stato attuale funzionante.
- Resend approvato per Fase B; variabili email opzionali finché non configurate.

## Convenzioni progetto (sempre valide)

- **Niente `experimental.*` in `next.config.ts`**: niente flag sperimentali (né `authInterrupts`, né `proxyClientMaxBodySize`, né altre). Next.js 16 espone ancora `bodySizeLimit` delle Server Action solo sotto `experimental`; preferiamo il default (1MB) finché non esiste una chiave stabile — sufficiente per una liberatoria per hold. Se serviranno upload multipli più grandi, spostare l'hold con file su Route Handler dedicato.
- **Calendario booking**: niente precarico colori/disponibilità mese; solo chiusure admin (`getMonthClosedDates`) + slot on-demand (`getAvailableSlots`) con cache client e prefetch al hover.
- **Server Actions read-only** (es. `getAvailableSlots`, `getMonthClosedDates`): niente rate limit; il rate limit resta sulle mutazioni (`holdSlot`, checkout, ecc.).
