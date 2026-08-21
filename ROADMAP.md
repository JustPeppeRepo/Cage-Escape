# Roadmap — Cage Escape Room

Documento vivo: **aggiornato al 2026-08-21** (Supabase Auth su `proxy.ts`, purge Better Auth, cron keep-alive, RLS, env post-migrazione).

---

## Panoramica architettura (come è fatto il progetto)

| Layer | Tecnologia | Ruolo |
|-------|------------|--------|
| **Frontend** | Next.js 16 App Router, React 19, Tailwind 4 | Pagine pubbliche, admin, account, checkout |
| **Auth** | **Supabase Auth** (`@supabase/ssr`) | Login/signup PKCE, sessioni cookie, callback `/auth/callback` |
| **API dati app** | **Prisma 7** + PostgreSQL (Neon/Supabase) | Business logic server-side: booking, pagamenti, admin |
| **Pagamenti** | Stripe Checkout + webhook | Hold → checkout → conferma via `StripeWebhookEvent` |
| **Edge gate** | `src/proxy.ts` (convenzione Next.js 16, ex middleware) | Manutenzione, refresh token, `getUser()`, rotte protette |
| **Sicurezza DB** | RLS Supabase (`supabase/migrations/`) | Isolamento righe su `profiles`, `Booking`, `Payment`, … |
| **Ops** | Vercel Cron (`/api/cron/keep-alive`) | Keep-alive connessione DB ogni 5 giorni (`CRON_SECRET`) |

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

### Flusso auth (attuale)

```
Signup/Login (Supabase browser client) → PKCE redirect → /auth/callback
       → exchangeCodeForSession → cookie session
       → trigger DB handle_new_user() → riga profiles
       → proxy.ts getUser() su rotte protette
       → DAL getCurrentSession() / validateUserSession() nelle Server Action
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

### Migrazione sicurezza Supabase — runtime **completo** (2026-08-20/21)

- [x] **Schema Prisma**: `User` → `Profile` (`@@map("profiles")`, `id @db.Uuid`); rimossi `Session`, `Account`, `Verification`
- [x] **SQL RLS**: `supabase/migrations/00_init_auth_and_rls.sql` (trigger `handle_new_user`, FORCE RLS, policy; **2026-08-21**: `ALTER … ADD COLUMN IF NOT EXISTS role`)
- [x] **Client Supabase**: `src/utils/supabase/client.ts`, `server.ts` (solo chiavi pubbliche nel browser)
- [x] **Prisma client**: `src/lib/prisma.ts` + duplicato ancora usato `src/app/_lib/prisma.ts`
- [x] **DAL**: `src/lib/dal.ts` → `getUser()` + query `profiles`
- [x] **Edge**: `src/proxy.ts` — Next.js 16, Supabase `getUser()`, manutenzione, gate rotte (**non è più Better Auth**)
- [x] **Auth callback PKCE**: `src/app/auth/callback/route.ts`
- [x] **Webhook Stripe**: idempotenza WRITE-FIRST su `StripeWebhookEvent`
- [x] **Cron keep-alive**: `src/app/api/cron/keep-alive/route.ts` + `vercel.json`
- [x] **UI auth**: `LoginForm`, `SignupForm`, `LogoutButton` → Supabase client
- [x] **Account actions**: password change/reset/delete via `validateUserSession()` + `supabase.auth.*`
- [x] **Resend verifica**: `src/actions/auth.ts` → `supabase.auth.resend({ type: "signup" })`
- [x] **Dipendenza `better-auth` rimossa** da `package.json`; route `[...better-auth]` e `auth-client.ts` **eliminati**
- [x] **Audit script**: `prisma.profile` (modello Prisma, non `prisma.profiles`)
- [x] **Env**: schema senza `BETTER_AUTH_*`; aggiunte `NEXT_PUBLIC_SUPABASE_*` e `CRON_SECRET` — vedi [`.env.example`](./.env.example)

### Ancora da fare prima del go-live

- [ ] **Applicare SQL RLS** su staging/prod (`00_init_auth_and_rls.sql` — **non** eseguire anche `00_hardened_auth_rls.sql`)
- [ ] **Prisma migrate** per tabella `profiles` e FK `userId @db.Uuid`
- [ ] **Impostare env** (Supabase, `CRON_SECRET`, Site URL / Redirect URLs in dashboard Auth) — vedi sotto
- [ ] **Allineare import Prisma**: molti file usano ancora `@/app/_lib/prisma`
- [ ] **Unificare checkout**: `holdSlot` vs `src/app/actions/booking-checkout.ts`
- [ ] Pulizia residua: commenti Better Auth in `src/actions/auth.ts` / `src/app/login/page.tsx`; matcher `proxy.ts` ancora esclude `api/auth`; fallback callback `/dashboard` (rotta inesistente → usare `/` o `/account`)
- [ ] `src/app/_lib/auth/email.ts` e lockout Better Auth sono **dead code** (lockout è no-op)

---

## Fase K — Migrazione Better Auth → Supabase Auth ✅ runtime / 🔄 deploy DB

### K.1 Database e RLS

| Task | File | Stato |
|------|------|--------|
| Schema Profile + purge modelli auth | `prisma/schema.prisma` | ✅ |
| Migrazione RLS + trigger profilo | `supabase/migrations/00_init_auth_and_rls.sql` | ✅ scritta (+ colonna `role` 2026-08-21) |
| Migrazione cleanup legacy (alternativa) | `supabase/migrations/00_hardened_auth_rls.sql` | ⚠️ **non eseguire entrambe** |
| Deploy Prisma | `npx prisma migrate dev` / `migrate deploy` | ⬜ manuale |
| Apply SQL Supabase | Dashboard SQL Editor o `supabase db push` | ⬜ manuale |

### K.2 Runtime applicativo

| Task | File | Stato |
|------|------|--------|
| Browser client | `src/utils/supabase/client.ts` | ✅ |
| Server client + cookie try/catch | `src/utils/supabase/server.ts` | ✅ |
| DAL sessione | `src/lib/dal.ts` | ✅ |
| Edge (Next.js 16 `proxy`) | `src/proxy.ts` | ✅ `getUser()` + manutenzione |
| PKCE callback | `src/app/auth/callback/route.ts` | ✅ |
| Server Action re-auth | `src/utils/supabase/auth-validation.ts` | ✅ |
| Route Better Auth | `src/app/api/auth/[...better-auth]/route.ts` | ✅ **eliminata** |
| Client Better Auth | `src/lib/auth-client.ts` | ✅ **eliminato** |
| Form login/signup | `src/components/horror/auth/*.tsx` | ✅ |
| Account actions | `src/app/_actions/account.ts` | ✅ Supabase |
| prepareLogin / resend verifica | `src/actions/auth.ts` | ✅ parziale (commenti legacy; lockout no-op) |

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
| Schedule Vercel | `vercel.json` | ✅ `0 0 */5 * *` |
| Secret cron | env `CRON_SECRET` su Vercel | ⬜ **manuale** — vedi `.env.example` |
| Env schema | `src/app/_lib/env.ts` + `.env.example` | ✅ 2026-08-21 |

---

## 🔐 Checklist validazione sicurezza manuale

**Eseguire prima di ogni deploy in produzione.** Spuntare ogni voce dopo verifica reale (non solo code review).

### Priorità CRITICA

| # | Cosa verificare | File da aprire / testare | Tag audit |
|---|----------------|----------------------------|-----------|
| 1 | **Proxy usa `getUser()`, mai `getSession()`** | `src/proxy.ts` | `[TOKEN_VALIDATION]` |
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
| 13 | Admin: `requireAdmin()` su ogni `page.tsx` sotto `/admin` (ruolo da `profiles`, non da JWT metadata) | `src/lib/dal.ts`, `src/app/admin/**/page.tsx` |
| 14 | Stripe metadata coerenti con booking (`bookingId`, `userId`, `paymentType`) | webhook handler + creazione session |
| 15 | Nessun write REST diretto su Booking/Payment (RLS blocca anon) | test con Supabase client anon key |
| 16 | Dashboard Supabase: Site URL + Redirect URLs allineati a `NEXT_PUBLIC_APP_URL` | Authentication → URL Configuration |

### Test manuali consigliati

```bash
# 1. Webhook locale
stripe listen --forward-to localhost:3000/api/webhook/stripe

# 2. Audit flussi Stripe
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
Account, reset password, Resend (contatti/ops; Auth ora via Supabase).

### Fase F — Sicurezza pagamenti ✅
Rate limit distribuito, refund policy, alert ops.

### Fase G — Hardening Stripe ✅ / backlog
- [x] Idempotenza `StripeWebhookEvent`, `charge.refunded`, audit script
- [ ] Dispute / auto-refund conflitti / job cleanup hold

### Fase H — Manutenzione ✅ / go-live
- [ ] Spegnere manutenzione (`src/app/_lib/site/maintenance.ts` → `desired = false`), iubenda, Stripe live, Resend dominio, asset OG

### Fase I — Co-location UI ✅
Refactoring sezioni home/about/nav.

### Fase J — Orari e cooldown ✅
`WeeklyOpeningHours`, `slotCooldownMinutes`, override multi-giorno.

</details>

---

## Variabili d'ambiente (post-migrazione Supabase)

**File di riferimento:** [`.env.example`](./.env.example) — copia in `.env` e compila.  
**Validazione:** `src/app/_lib/env.ts` (manca una env obbligatoria → l'app non parte).

| Variabile | Dove prenderla | Note |
|-----------|----------------|------|
| `DATABASE_URL` | Supabase → **Project Settings → Database → Connection string** (URI). Pooler 6543 in serverless; Direct 5432 per migrate. Oppure Neon. | Server / Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API → Project URL** | Pubblico |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Stessa pagina → **Project API keys → `anon` `public`** | Pubblico, RLS applicata |
| `SUPABASE_SERVICE_ROLE_KEY` | Stessa pagina → `service_role` | **Non usata dal codice.** Mai `NEXT_PUBLIC_`. Bypass RLS. |
| Redirect Auth (non-env) | Supabase → **Authentication → URL Configuration** | Site URL = `NEXT_PUBLIC_APP_URL`; allow list `/auth/callback` |
| `CRON_SECRET` | **La generi tu** (`openssl rand -hex 32`) e la metti in **Vercel → Settings → Environment Variables** | Vercel la manda come `Authorization: Bearer …` ai cron in `vercel.json` |
| `STRIPE_SECRET_KEY` | [Stripe API keys](https://dashboard.stripe.com/apikeys) | `sk_` o `rk_` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks, oppure `stripe listen` in locale | `whsec_` |
| `NEXT_PUBLIC_APP_URL` | Dominio pubblico (prod: `https://cageroom.it`, **non** `*.vercel.app`) | Callback, Stripe URLs |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | [resend.com/api-keys](https://resend.com/api-keys) + [domains](https://resend.com/domains) | Contatti + alert ops. Auth email = dashboard Supabase (SMTP opzionale) |
| `CONTACT_EMAIL_TO` / `STRIPE_OPS_EMAIL_TO` | Caselle staff | Ops fallback su contact se vuoto |
| `NEXT_PUBLIC_IUBENDA_*` | Dashboard iubenda | Opzionali |
| `VERCEL_ENV` | Impostata da Vercel | Manutenzione + rate-limit fail-closed |

**Rimuovere dal `.env`:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (non più lette).

---

## Convenzioni progetto (aggiornate 2026-08-21)

- **Gate auth:** **`src/proxy.ts`** (Next.js 16). Non esiste `src/middleware.ts`. Usa solo `getUser()`.
- **Sessione server-side:** **`src/lib/dal.ts`** (`getCurrentSession`, `requireUser`, `requireAdmin`) oppure `validateUserSession()` per le action account.
- **Prisma:** preferire **`src/lib/prisma.ts`**; deprecare duplicato `src/app/_lib/prisma.ts` quando gli import saranno migrati.
- **Due cartelle actions:** `src/app/_actions/` (canonico storico) e `src/app/actions/` (checkout post-audit) — unificare quando possibile.
- **Manutenzione:** `src/app/_lib/site/maintenance.ts`, già integrata in `proxy.ts`.
- **Documentazione:** `SECURITY_AUDIT_MIGRATION.md`, `CONCURRENCY_AUDIT_REPORT.md`, `PROJECT_STRUCTURE.md`.

---

## Prossimi passi consigliati (ordine)

1. **Compilare `.env` / Vercel env** (Supabase + `CRON_SECRET` + Site URL / Redirect URLs)
2. **Eseguire migrazioni DB** (Prisma + SQL `00_init_auth_and_rls.sql`) in staging
3. **Test checklist sicurezza** (tabella sopra)
4. **Unificare flusso booking** (holdSlot vs booking-checkout) e client Prisma
5. **Go-live Fase H** (manutenzione off, Stripe live, legali)

---

*In caso di conflitto tra questo documento e il codice, vince il repository. Lo stato transizionale Better Auth → Supabase è chiuso a livello runtime; resta il deploy DB e il cleanup Prisma duplicato.*
