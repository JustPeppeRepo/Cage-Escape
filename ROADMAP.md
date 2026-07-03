# Roadmap — Cage Room

Documento vivo: aggiornato al completamento del piano Admin + pagine pubbliche + easter egg.

## Stato attuale (riepilogo — già fatto, non ritoccare)

- [x] Auth: Better Auth (login/signup, cookie/session server-side via `src/lib/dal.ts`, `trustedOrigins`)
- [x] Home page: hero cinematico, nebbia animata, card stanze da Prisma, teschi terrore, recensioni polaroid (statiche), FAQ accordion, JSON-LD `LocalBusiness`, `JumpScare.tsx`, footer con dettagli nascosti
- [x] Listing e dettaglio stanze (`/rooms`, `/rooms/[slug]`) con calendario e booking widget (+ campo codice sconto)
- [x] Checkout con countdown hold (`/checkout?bookingId=`), polling stato pagamento
- [x] Stripe Checkout + webhook con verifica firma, controllo importo/valuta/metadata, gestione pagamenti duplicati, stato `PAYMENT_CONFLICT_REFUND_REQUIRED`, sconto easter egg
- [x] Prevenzione doppie prenotazioni: transazioni `Serializable` + vincolo `EXCLUDE` a DB
- [x] Rilascio automatico hold scaduti (`releaseExpiredHolds`) + cap prenotazioni pendenti per utente
- [x] Rate limiting su login, signup, contact, getAvailableSlots, holdSlot, createStripeCheckoutSession, generateDiscountCode
- [x] Validazione Zod su tutte le Server Action; nessun calcolo prezzo lato client
- [x] Due round di security review (open redirect, enumerazione utenti, ecc.)
- [x] Pannello Admin completo (`/admin`, rooms, schedule, bookings, impostazioni)
- [x] Pagine `/about`, `/contatti`, `/maledizione`

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
- [ ] (Facoltativo) recensioni da DB invece che statiche

## Note di coerenza

- In caso di conflitto col prompt architetturale, vince lo stato attuale funzionante.
- Resend approvato per Fase B; variabili email opzionali finché non configurate.
