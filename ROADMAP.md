# Roadmap — Cage Escape Room

Documento vivo: aggiornato al 2026-07-27 (orari settimanali admin, cooldown slot, override multi-giorno, StarRating, manutenzione solo-prod, Stripe `rk_`, co-location UI, iubenda/SEO).

## Stato attuale (riepilogo — già fatto)

- [x] Auth: Better Auth (login/signup, cookie/session server-side via `src/lib/dal.ts`, `trustedOrigins`, verifica email, lockout login)
- [x] Home page: hero cinematico (video), card stanze da Prisma, recensioni da DB, FAQ, JSON-LD `LocalBusiness`, footer
- [x] Listing e dettaglio stanze (`/rooms`, `/rooms/[slug]`) con calendario e booking widget (+ codice sconto)
- [x] Checkout con countdown hold (`/checkout?bookingId=`), polling stato pagamento, success page
- [x] Stripe Checkout + webhook (firma, importo, metadata, duplicati, `PAYMENT_CONFLICT_REFUND_REQUIRED`, sconto easter egg; chiavi `sk_` e restricted `rk_`)
- [x] Prevenzione doppie prenotazioni: transazioni `Serializable` + vincolo `EXCLUDE` a DB
- [x] Rilascio hold scaduti (`releaseExpiredHolds`) + cap prenotazioni pendenti per utente
- [x] Rate limiting su mutazioni sensibili (Postgres `RateLimitCounter` / Neon in prod, fail-closed; in-memory solo in dev se DB irraggiungibile)
- [x] Validazione Zod su Server Action; nessun calcolo prezzo lato client
- [x] Liberatoria minorenni: upload PDF in prenotazione (`BookingWaiver`), download template `/documents/liberatoria.pdf`, download admin
- [x] Pannello Admin (`/admin`: rooms + media, schedule/orari settimanali, bookings, reviews, contatti, impostazioni)
- [x] Pagine `/about`, `/contatti`, `/maledizione`
- [x] Area utente `/account` + recupero password
- [x] Annullamento self-service con rimborso Stripe (>48h)
- [x] SEO: metadata, `sitemap.ts`, `robots.ts`, ottimizzazioni mobile
- [x] Analytics: Vercel Analytics + Speed Insights (disattivati in manutenzione)
- [x] Legale (hook): pagine placeholder `/privacy`, `/cookie`, `/termini` + integrazione iubenda opzionale via env (`NEXT_PUBLIC_IUBENDA_*`)
- [x] Next.js 16: gate richieste in `proxy.ts` (ex `middleware.ts`, deprecato)
- [x] **Manutenzione pubblica** (attiva in produzione Vercel): unica pagina muta, resto bloccato — toggle in `src/app/_lib/site/maintenance.ts` (`desired` + `VERCEL_ENV === "production"`)

## Fase A — Pannello Admin ✅

- [x] `/admin/rooms`: CRUD stanze + tier di prezzo + upload foto
- [x] `/admin/schedule`: orari settimanali (`WeeklyOpeningHours`) + CRUD `ScheduleOverride` (anche multi-giorno / range)
- [x] `/admin/bookings`: elenco, filtri, annullamento, evidenza conflitti pagamento, download liberatorie
- [x] `/admin/impostazioni`: `SiteSettings` (sconto easter egg + cooldown slot minuti)
- [x] `/admin/reviews`: CRUD recensioni homepage
- [x] `/admin/contatti`: messaggi dal form contatti
- [x] Dashboard overview in `/admin`

## Fase B — Pagine pubbliche ✅

- [x] `/about`
- [x] `/contatti` + `ContactMessage` + Resend (env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_EMAIL_TO`)
- [x] Footer con link legali / social

## Fase C — Easter Egg ✅

- [x] `/maledizione` + `DiscountCode` + redemption server-side da `SiteSettings`

## Fase D — Rifiniture ✅

- [x] Shake su errori login/signup
- [x] `src/lib/logger.ts`
- [x] Tipi consolidati in `src/types/`
- [x] `.env.example`
- [x] Navbar pubblica con sessione server-side (`SiteNav`)
- [x] Recensioni homepage da DB con CRUD admin
- [x] Brand/SEO: positioning escape room immersiva (non solo horror), CTA conversione, hero video
- [x] Difficoltà stanze: `StarRating` (ex `SkullRating`)

## Fase E — Area utente e recupero password ✅

- [x] `/account`: profilo con avatar, ordini, cambio password, eliminazione account
- [x] Recupero password: `/forgot-password`, `/reset-password`
- [x] Email reset / verifica via Resend (`RESEND_FROM_EMAIL` obbligatorio se c’è API key)
- [x] Blocco eliminazione account con prenotazioni attive o pagate

## Fase F — Sicurezza pagamenti e policy di rimborso ✅

- [x] Rate limiting distribuito su Neon Postgres (`RateLimitCounter`) con fallback in-memory solo in sviluppo
- [x] Riserva atomica del codice sconto + guardia webhook
- [x] Refund Stripe obbligatorio nell’annullamento admin, incluso `PAYMENT_CONFLICT_REFUND_REQUIRED`
- [x] `customRules` Better Auth + lockout account
- [x] Alert operativi email per conflitti pagamento
- [x] Rimozione `experimental.authInterrupts` (sostituita con `notFound()`)
- [x] Ogni ramo `PAYMENT_CONFLICT_REFUND_REQUIRED` registra `Payment` tracciabile
- [x] Annullamento self-service `/account` con rimborso automatico se >48h prima dell’evento

## Fase G — Hardening Stripe prenotazioni (audit 2026-07-24) ✅ / backlog

Script di regressione: `scripts/audit-stripe-payment-flows.ts`.

- [x] Idempotenza webhook su `event.id` (`StripeWebhookEvent`)
- [x] Alert ops deferred con `after()`
- [x] Confronto importo in centesimi interi
- [x] Handler `charge.refunded`
- [x] `payment_intent.payment_failed` documentato come no-op
- [x] Alias path `/api/webhooks/stripe`
- [x] Admin cancel: claim `CANCELLED` prima dei refund
- [x] `releaseExpiredHolds` anche in lettura slot
- [x] Re-test automatizzato: `scripts/audit-stripe-payment-flows.ts` (14/14 PASS)
- [x] Validatore `STRIPE_SECRET_KEY`: accetta `sk_` e restricted key `rk_` (anche con `_` nel body)
- [ ] Dispute / chargeback (`charge.dispute.created`)
- [ ] Auto-refund sui conflitti `PAYMENT_CONFLICT_REFUND_REQUIRED`
- [ ] Job periodico cleanup hold scaduti

## Fase H — Manutenzione e prep go-live ✅ / aperto

### Fatto

- [x] Flag centralizzato in `src/app/_lib/site/maintenance.ts` (`desired` + gate `VERCEL_ENV === "production"`)
- [x] Pagina muta `MaintenanceScreen` + route `/manutenzione`
- [x] Gate: `proxy.ts` (rewrite `/` → manutenzione, redirect resto → `/`) + redirect backup in `next.config.ts`
- [x] Con manutenzione ON: niente nav, floating CTA, Iubenda, Analytics, Speed Insights; `robots` disallow; sitemap vuota
- [x] In locale / preview Vercel: sito normale anche con `desired: true`
- [x] Hook iubenda nel layout/footer (si attiva solo con ID in env)
- [x] Pagine legali placeholder locali finché iubenda non è configurato

### Aperto (prima del lancio pubblico pieno)

- [ ] Spegnere manutenzione: `desired = false` in `src/app/_lib/site/maintenance.ts`
- [ ] Configurare iubenda (Privacy / Cookie / Termini) e ID in env Vercel
- [ ] PDF liberatoria legale reale (sostituire `public/documents/liberatoria.pdf` demo)
- [ ] Stripe live (`sk_live_` / `rk_live_`, webhook live, `STRIPE_WEBHOOK_SECRET` live)
- [ ] Resend: dominio verificato + `RESEND_FROM_EMAIL` + `CONTACT_EMAIL_TO` / ops email
- [ ] URL prod allineati: `NEXT_PUBLIC_APP_URL` = `BETTER_AUTH_URL`
- [ ] Contatti/social reali (indirizzo, WhatsApp, mappa, orari in `/contatti`)
- [ ] Asset: favicon, apple-touch, OG image
- [ ] Backlog Fase G residuo (dispute, auto-refund conflitti, job hold)

### Come riaprire il sito

1. In `src/app/_lib/site/maintenance.ts` imposta `desired: false`
2. Deploy (o riavvio locale)
3. Verifica che `/rooms`, login e checkout rispondano di nuovo in produzione

## Fase I — Co-location UI pubblica ✅

Refactoring UI (2026-07-27): meno file frammentati, stesso aspetto/UX. Auth, Stripe e Server Action di mutazione **non** riscritti (solo path import dove serviva).

- [x] Home: sezioni verticali in ordine di resa — `HeroSection`, `RoomsSection`, `ReviewsSection` (+ ReviewCard), `FaqSection`, `BookingCtaSection`
- [x] Hero: `FogOverlay` inline in `HeroSection`; `HeroVideo` resta client separato
- [x] About: un solo `AboutContent.tsx`; rimossi frecce disattivate (`AboutFlowArrows`, `aboutArrowArt`) e micro-sezioni
- [x] Nav: `SiteNavShell` + `SiteNavAuth` uniti in `SiteNav`; resta `SiteNavClient`
- [x] Room detail: `dynamic()` di `BookingWidget` inline in `rooms/[slug]/page.tsx` (loader dedicato eliminato)
- [x] Cleanup: cartella vuota `photographer/`, campo inutilizzato `LEGAL_ENTITY.tradeName`; rimossi `CHECKLIST-PUBBLICAZIONE.md` e `STRIPE_INTEGRATION_ROADMAP.md` (contenuti assorbiti qui)
- [x] Fuori scope (intatti): webhook/checkout Stripe, Better Auth, interni `BookingWidget` / form auth, pannello admin

## Fase J — Orari, slot e cooldown ✅

Gestione disponibilità (2026-07-27).

- [x] Modello `WeeklyOpeningHours` (lun–dom: aperto/chiuso + open/close hour) con seed/ensure 7 righe
- [x] Resolver giorno: **override** → **orario settimanale** → fallback 10–22
- [x] Admin `/admin/schedule`: form orari settimanali + override multi-giorno (lista date o range Dal→Al, max 62)
- [x] `SiteSettings.slotCooldownMinutes` (default 15, admin 0–120): buffer tra fine sessione e inizio successiva
- [x] Generazione slot: step = durata stanza + cooldown; occupancy considera il cooldown
- [x] UI booking: ogni slot mostra `inizio – fine` (es. `12:00 – 13:30`)
- [x] Giorni settimanali chiusi non prenotabili anche sul calendario (`getMonthClosedDates`)
- [x] Prisma client revision (`PRISMA_CLIENT_REVISION`) per evitare HMR con DMMF obsoleto dopo `prisma generate`

## Note

- In caso di conflitto col prompt architetturale, vince lo stato attuale funzionante.
- Resend: con sola API key e senza `RESEND_FROM_EMAIL` su dominio verificato, le email auth non arrivano agli utenti reali.
- Webhook Stripe in locale: serve `stripe listen --forward-to localhost:3000/api/webhook/stripe` e aggiornare `STRIPE_WEBHOOK_SECRET` con il `whsec_...` della CLI.

## Convenzioni progetto (sempre valide)

- **`proxy.ts`, non `middleware.ts`**: su Next.js 16 la convenzione middleware è deprecata; il gate auth + manutenzione vive in `proxy.ts` (`export function proxy`). Non reintrodurre `middleware.ts`.
- **Niente `experimental.*` in `next.config.ts`**: niente flag sperimentali. Next.js 16 espone ancora `bodySizeLimit` delle Server Action solo sotto `experimental`; preferiamo il default (1MB). Se serviranno upload multipli più grandi sull’hold, Route Handler dedicato.
- **Manutenzione**: un solo punto di controllo — `src/app/_lib/site/maintenance.ts` (`desired`). In produzione Vercel si attiva solo se `desired && VERCEL_ENV === "production"`. Non spargere altri flag.
- **Orari**: priorità override giorno → `WeeklyOpeningHours` → `DEFAULT_OPEN/CLOSE_HOUR`. Cooldown globale in `SiteSettings.slotCooldownMinutes`.
- **Calendario booking**: niente precarico colori/disponibilità mese; solo chiusure admin (`getMonthClosedDates`) + slot on-demand (`getAvailableSlots`) con cache client e prefetch al hover.
- **Server Actions read-only** (es. `getAvailableSlots`, `getMonthClosedDates`): niente rate limit; il rate limit resta sulle mutazioni (`holdSlot`, checkout, ecc.).
- **Env**: accesso solo via `src/app/_lib/env.ts`, mai `process.env` sparso nel codice applicativo (eccezione ammessa: gate manutenzione su `VERCEL_ENV`).
`)