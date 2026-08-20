# Roadmap — Cage Escape Room

Documento vivo: **aggiornato al 2026-08-20** (migrazione Supabase Auth, RLS Postgres, hardening webhook/cron, audit concorrenza booking).

---

## Panoramica architettura (come è fatto il progetto)

| Layer | Tecnologia | Ruolo |
|-------|------------|--------|
| **Frontend** | Next.js 16 App Router, React 19, Tailwind 4 | Pagine pubbliche, admin, account, checkout |
| **Auth** | **Supabase Auth** (`@supabase/ssr`) — *migrazione in corso* | Login/signup PKCE, sessioni cookie, callback `/auth/callback` |
| **API dati app** | **Prisma 7** + PostgreSQL (Neon/Supabase) | Business logic server-side: booking, pagamenti, admin |
| **Pagamenti** | Stripe Checkout + webhook | Hold → checkout → conferma via `StripeWebhookEvent` |
| **Edge gate** | `src/middleware.ts` (Supabase) + `proxy.ts` (legacy Better Auth) | Protezione rotte, refresh token — **⚠️ da unificare** |
| **Sicurezza DB** | RLS Supabase (`supabase/migrations/`) | Isolamento righe su `profiles`, `Booking`, `Payment`, … |
| **Ops** | Vercel Cron (`/api/cron/keep-alive`) | Keep-alive connessione DB ogni 5 giorni |

### Flusso prenotazione (end-to-end)

```
Utente → /rooms/[slug] → selezione slot
       → holdSlot (Server Action, transazione Serializable)
       → /checkout?bookingId=…
       → createStripeCheckoutSession (prezzi da RoomPricingTier, mai dal client)
       → Stripe Checkout
       → webhook checkout.session.completed (idempotenza event.id)
       → Booking PAID / DEPOSIT_PAID + Payment
```

### Flusso auth (target post-migrazione)

```
Signup/Login (Supabase client) → PKCE redirect → /auth/callback
       → exchangeCodeForSession → cookie session
       → trigger DB handle_new_user() → riga profiles
       → middleware getUser() su rotte protette
       → DAL getCurrentSession() nelle Server Action
```

---

## Stato attuale (riepilogo — già fatto)

### Prodotto e business logic (invariato)

- [x] Listing e dettaglio stanze, calendario, widget prenotazione, codice sconto
- [x] Checkout con hold, polling, success page
- [x] Stripe Checkout + webhook (firma, importo, metadata, duplicati, conflitti rimborso)
- [x] Prevenzione doppie prenotazioni: transazioni `Serializable` + vincolo `EXCLUDE` a DB
- [x] Rate limiting su mutazioni sensibili (`RateLimitCounter`)
- [x] Validazione Zod; **nessun calcolo prezzo lato client**
- [x] Liberatoria minorenni, pannello admin completo, area `/account`
- [x] Annullamento self-service con rimborso Stripe (>48h)
- [x] SEO, analytics, manutenzione prod, iubenda opzionale

### Migrazione sicurezza Supabase (2026-08-20) — **parziale**

- [x] **Schema Prisma**: `User` → `Profile` (`@@map("profiles")`, `id @db.Uuid`); rimossi `Session`, `Account`, `Verification`
- [x] **SQL RLS**: `supabase/migrations/00_init_auth_and_rls.sql` (trigger `handle_new_user`, FORCE RLS, policy utente/admin/service_role)
- [x] **Client Supabase**: `src/utils/supabase/client.ts`, `server.ts` (solo chiavi pubbliche nel browser)
- [x] **Prisma client**: `src/lib/prisma.ts` (pool PG, cache globale)
- [x] **DAL**: `src/lib/dal.ts` → `getUser()` + query `profiles` (non più Better Auth)
- [x] **Middleware Supabase**: `src/middleware.ts` (`getUser()`, rotte protette, refresh cookie)
- [x] **Auth callback PKCE**: `src/app/auth/callback/route.ts` (open-redirect defense)
- [x] **Webhook Stripe**: idempotenza WRITE-FIRST su `StripeWebhookEvent` (`src/app/api/webhook/stripe/route.ts`)
- [x] **Cron keep-alive**: `src/app/api/cron/keep-alive/route.ts` + `vercel.json`
- [x] **UI auth**: `LoginForm`, `SignupForm`, `LogoutButton` → Supabase client
- [x] **Audit documentazione**: `SECURITY_AUDIT_MIGRATION.md`, `CONCURRENCY_AUDIT_REPORT.md`
- [x] **Server Action checkout (nuova)**: `src/app/actions/booking-checkout.ts` (transazione atomica post-audit)

### Legacy ancora presente — **da completare prima del go-live auth**

- [ ] **`proxy.ts`**: usa ancora `better-auth/cookies` e gate ottimistico legacy
- [ ] **`src/app/api/auth/[...better-auth]/route.ts`**: route Better Auth (da eliminare)
- [ ] **`src/lib/auth-client.ts`**: client Better Auth (da eliminare o sostituire)
- [ ] **`src/actions/auth.ts`**: lockout/verifica legati al vecchio stack (da riscrivere su Supabase)
- [ ] **Unificare gate edge**: scegliere **solo** `src/middleware.ts` *oppure* migrare manutenzione in middleware e rimuovere `proxy.ts`
- [ ] **Applicare migrazioni SQL** su Supabase prod (vedi checklist sotto)
- [ ] **Prisma migrate** per tabella `profiles` e FK `userId @db.Uuid`
- [ ] **Allineare import Prisma**: molti file usano ancora `@/app/_lib/prisma` e `@/generated/prisma/client`

---

## Fase K — Migrazione Better Auth → Supabase Auth 🔄

### K.1 Database e RLS

| Task | File | Stato |
|------|------|--------|
| Schema Profile + purge modelli auth | `prisma/schema.prisma` | ✅ |
| Migrazione RLS + trigger profilo | `supabase/migrations/00_init_auth_and_rls.sql` | ✅ scritta |
| Migrazione cleanup legacy (alternativa) | `supabase/migrations/00_hardened_auth_rls.sql` | ⚠️ **non eseguire entrambe** — scegliere una strategia |
| Deploy Prisma | `npx prisma migrate dev` | ⬜ manuale |
| Apply SQL Supabase | Dashboard SQL o `supabase db push` | ⬜ manuale |

### K.2 Runtime applicativo

| Task | File | Stato |
|------|------|--------|
| Browser client | `src/utils/supabase/client.ts` | ✅ |
| Server client + cookie try/catch | `src/utils/supabase/server.ts` | ✅ |
| DAL sessione | `src/lib/dal.ts` | ✅ |
| Edge middleware | `src/middleware.ts` | ✅ |
| PKCE callback | `src/app/auth/callback/route.ts` | ✅ |
| Rimuovere Better Auth route | `src/app/api/auth/[...better-auth]/route.ts` | ⬜ |
| Aggiornare proxy/manutenzione | `proxy.ts` → middleware unificato | ⬜ |
| Form login/signup | `src/components/horror/auth/*.tsx` | ✅ parziale |
| Account actions | `src/app/_actions/account.ts` | ⬜ verificare compatibilità Profile |

### K.3 Pagamenti e booking (sicurezza)

| Task | File | Stato |
|------|------|--------|
| Hold slot atomico (canonico) | `src/app/_actions/bookings.ts` → `holdSlot` | ✅ Serializable |
| Checkout Stripe (canonico) | `src/app/_actions/bookings.ts` → `createStripeCheckoutSession` | ✅ |
| Checkout alternativo (nuovo) | `src/app/actions/booking-checkout.ts` | ✅ transazione post-audit — **decidere se unificare con holdSlot** |
| Webhook idempotente | `src/app/api/webhook/stripe/route.ts` | ✅ WRITE-FIRST |
| Alias webhook | `src/app/api/webhooks/stripe/route.ts` | ✅ |

### K.4 Ops e infrastruttura

| Task | File | Stato |
|------|------|--------|
| Cron keep-alive | `src/app/api/cron/keep-alive/route.ts` | ✅ |
| Schedule Vercel | `vercel.json` | ✅ ogni 5 giorni |
| Secret cron | env `CRON_SECRET` su Vercel | ⬜ manuale |

---

## 🔐 Checklist validazione sicurezza manuale

**Eseguire prima di ogni deploy in produzione.** Spuntare ogni voce dopo verifica reale (non solo code review).

### Priorità CRITICA

| # | Cosa verificare | File da aprire / testare | Tag audit |
|---|----------------|----------------------------|-----------|
| 1 | **Middleware usa `getUser()`, mai `getSession()`** | `src/middleware.ts` | `[TOKEN_VALIDATION]` |
| 2 | **Nessuna `SUPABASE_SERVICE_ROLE_KEY` nel bundle client** | `src/utils/supabase/client.ts`, build `npm run build` + ispeziona chunk | `[ENV_LEAK]` |
| 3 | **Server Supabase: cookie `setAll` in try/catch** | `src/utils/supabase/server.ts` | `[COOKIE_HANDLING]` |
| 4 | **RLS FORCE su tabelle sensibili** | `supabase/migrations/00_init_auth_and_rls.sql` → eseguire su DB e controllare `\d+ profiles` | `[DB_RLS]` |
| 5 | **Trigger profilo: `SET search_path = public, auth`** | stesso file SQL, funzione `handle_new_user` | `[SECURITY_DEFINER]` |
| 6 | **Webhook: firma Stripe + claim `event.id` PRIMA della business logic** | `src/app/api/webhook/stripe/route.ts` | `[WEBHOOK_SECURITY]` |
| 7 | **Booking: check disponibilità + create nella stessa `$transaction`** | `src/app/_actions/bookings.ts` (`holdSlot`), `src/app/actions/booking-checkout.ts` | `[CONCURRENCY_PROTECTION]` |
| 8 | **Prezzi solo server-side da `RoomPricingTier`** | `src/app/_actions/bookings.ts`, `src/app/actions/booking-checkout.ts` | `[PAYMENT_INTEGRITY]` |
| 9 | **IDOR: booking sempre con `userId` della sessione validata** | `src/lib/dal.ts`, actions booking | `[IDOR_PREVENTION]` |
| 10 | **Callback auth: redirect solo path interni** | `src/app/auth/callback/route.ts` | `[ROUTE_PROTECTION]` |

### Priorità ALTA

| # | Cosa verificare | File |
|---|----------------|------|
| 11 | Cron: header `Authorization` vs `CRON_SECRET` (timing-safe) | `src/app/api/cron/keep-alive/route.ts` |
| 12 | Rate limit su checkout/hold/cancel | `src/app/_lib/rate-limit.ts`, actions |
| 13 | Admin: `requireAdmin()` su ogni `page.tsx` sotto `/admin` | `src/lib/dal.ts`, `src/app/admin/**/page.tsx` |
| 14 | Stripe metadata coerenti con booking (`bookingId`, `userId`, `paymentType`) | webhook handler + creazione session |
| 15 | Nessun write REST diretto su Booking/Payment (RLS blocca anon) | test con Supabase client anon key |

### Test manuali consigliati

```bash
# 1. Webhook locale
stripe listen --forward-to localhost:3000/api/webhook/stripe

# 2. Audit flussi Stripe (se presente)
npx tsx scripts/audit-stripe-payment-flows.ts

# 3. Concorrenza hold (due tab stesso slot → una sola deve vincere)
# 4. Login → /auth/callback → redirect sicuro (?next=//evil.com deve fallire)
# 5. Cron (solo con CRON_SECRET impostato)
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/keep-alive
```

---

## Fasi precedenti (storico — completate)

<details>
<summary>Fase A–J (admin, UI, Stripe, manutenzione, orari) — espandi</summary>

### Fase A — Pannello Admin ✅
CRUD stanze, schedule, bookings, impostazioni, reviews, contatti.

### Fase B — Pagine pubbliche ✅
About, contatti, footer legali.

### Fase C — Easter Egg ✅
`/maledizione` + `DiscountCode`.

### Fase D — Rifiniture ✅
Logger, tipi, navbar, SEO brand.

### Fase E — Area utente ✅
Account, reset password, Resend.

### Fase F — Sicurezza pagamenti ✅
Rate limit distribuito, refund policy, alert ops.

### Fase G — Hardening Stripe ✅ / backlog
- [x] Idempotenza `StripeWebhookEvent`, `charge.refunded`, audit script
- [ ] Dispute / auto-refund conflitti / job cleanup hold

### Fase H — Manutenzione ✅ / go-live
- [ ] Spegnere manutenzione, iubenda, Stripe live, Resend dominio, asset OG

### Fase I — Co-location UI ✅
Refactoring sezioni home/about/nav.

### Fase J — Orari e cooldown ✅
`WeeklyOpeningHours`, `slotCooldownMinutes`, override multi-giorno.

</details>

---

## Variabili d'ambiente (post-migrazione Supabase)

| Variabile | Dove | Note |
|-----------|------|------|
| `DATABASE_URL` | Server / Prisma | Connessione Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Pubblico |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Pubblico, RLS applicata |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo server se necessario** — mai import in client | Bypass RLS: usare con estrema cautela |
| `STRIPE_SECRET_KEY` | Server | `sk_` o `rk_` |
| `STRIPE_WEBHOOK_SECRET` | Webhook route | `whsec_` |
| `CRON_SECRET` | Cron route + Vercel | Bearer token per keep-alive |
| `NEXT_PUBLIC_APP_URL` | Callback, Stripe URLs | Deve coincidere con dominio prod |
| `RESEND_*` | Email auth/contatti | Opzionale ma richiesto per email reali |

---

## Convenzioni progetto (aggiornate 2026-08-20)

- **Gate auth**: target = **`src/middleware.ts`** con Supabase `getUser()`. `proxy.ts` è **legacy** finché non migrato.
- **Sessione server-side**: sempre via **`src/lib/dal.ts`** (`getCurrentSession`, `requireUser`, `requireAdmin`).
- **Prisma**: preferire **`src/lib/prisma.ts`**; deprecare duplicato `src/app/_lib/prisma.ts` quando gli import saranno migrati.
- **Due cartelle actions**: `src/app/_actions/` (canonico storico) e `src/app/actions/` (nuove action post-migrazione) — unificare quando possibile.
- **Manutenzione**: resta in `src/app/_lib/site/maintenance.ts` — integrare nel middleware Supabase prima di rimuovere `proxy.ts`.
- **Documentazione sicurezza**: `SECURITY_AUDIT_MIGRATION.md` (checklist auth/payment/cron), `CONCURRENCY_AUDIT_REPORT.md` (race booking).

---

## Prossimi passi consigliati (ordine)

1. **Eseguire migrazioni DB** (Prisma + SQL Supabase) in staging
2. **Completare purge Better Auth** (proxy, route, auth-client)
3. **Test checklist sicurezza** (tabella sopra)
4. **Unificare flusso booking** (holdSlot vs booking-checkout)
5. **Go-live Fase H** (manutenzione off, Stripe live, legali)

---

*In caso di conflitto tra questo documento e il codice, verificare sempre il repository; se la migrazione Supabase è a metà, vince lo stato transitional descritto in Fase K.*
