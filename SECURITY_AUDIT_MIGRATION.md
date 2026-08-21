# Security Audit & Migration — Master Document

**Progetto:** Cage Escape Room (`cageroom_3.0`)  
**Ultimo aggiornamento:** 2026-08-21  
**Scope:** Migrazione Better Auth → Supabase, RLS Postgres, hardening pagamenti, edge auth, cron ops  

Documenti correlati:
- [`ROADMAP.md`](./ROADMAP.md) — fasi, backlog, **checklist manuale pre-deploy**, dove trovare le env
- [`.env.example`](./.env.example) — template variabili d'ambiente
- [`CONCURRENCY_AUDIT_REPORT.md`](./CONCURRENCY_AUDIT_REPORT.md) — race condition booking
- [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — indice file e rotte

---

## Executive summary

La migrazione introduce **defense-in-depth** su tre piani:

1. **Edge / Auth** — Supabase `getUser()` (mai `getSession()`), callback PKCE, proxy fail-closed  
2. **Database** — RLS FORCE su tabelle sensibili, trigger profilo con `search_path` bloccato  
3. **Pagamenti** — prezzi solo server-side, webhook idempotente WRITE-FIRST, hold atomico Serializable  

**Stato (2026-08-21):** runtime Auth **su Supabase**. `src/proxy.ts` è il gate Next.js 16 (ex middleware). Pacchetto Better Auth, route `[...better-auth]` e `auth-client.ts` **rimossi**. Restano: applicare SQL RLS + Prisma migrate in staging/prod, unificare i due client Prisma e i due flussi checkout, impostare `CRON_SECRET` e le chiavi Supabase.

---

## Parti del progetto (spiegazione)

### 1. Autenticazione (Supabase)

| Componente | Path | Funzione |
|------------|------|----------|
| Client browser | `src/utils/supabase/client.ts` | Login/signup lato client con anon key |
| Client server | `src/utils/supabase/server.ts` | Server Components / Actions con cookie |
| Callback PKCE | `src/app/auth/callback/route.ts` | Scambia `code` → sessione; sanitizza redirect |
| Edge (Next.js 16) | `src/proxy.ts` | Refresh token, manutenzione, protegge `/account`, `/checkout`, `/admin`, … |
| DAL | `src/lib/dal.ts` | Unica fonte sessione server-side per pages/actions |
| Re-auth action | `src/utils/supabase/auth-validation.ts` | `validateUserSession()` per Server Action account |

**Flusso:** utente fa login → redirect OAuth/PKCE → `/auth/callback` → cookie → proxy valida con `getUser()` → DAL legge profilo da `profiles`.

**Non esiste** `src/middleware.ts`. Non usare `getSession()`.

### 2. Database applicativo (Prisma)

| Componente | Path | Funzione |
|------------|------|----------|
| Schema | `prisma/schema.prisma` | Modelli business (`Profile`, `Booking`, …) |
| Client preferito | `src/lib/prisma.ts` | Connessione pooled server-side |
| Client legacy (ancora importato) | `src/app/_lib/prisma.ts` | Stesso adapter; **da deprecare** |
| Migrazioni | `prisma/migrations/` | Evoluzione schema (include storico Better Auth) |

Prisma gestisce **tutta la business logic** (booking, pagamenti, admin). Supabase RLS aggiunge un secondo strato se qualcuno accede al DB via REST con anon key.

### 3. Sicurezza Postgres (Supabase RLS)

| Componente | Path | Funzione |
|------------|------|----------|
| Init RLS | `supabase/migrations/00_init_auth_and_rls.sql` | Trigger `handle_new_user`, policy, FORCE RLS, `profiles.role` |
| Cleanup alt. | `supabase/migrations/00_hardened_auth_rls.sql` | Migrazione da tabelle legacy — **scegliere una sola strategia** |

**Policy chiave:**
- Utente autenticato: SELECT/UPDATE solo proprio `profiles`, proprie `Booking`
- `Booking`/`Payment`: write REST bloccato per anon/authenticated (solo server Prisma / service role)
- Admin: policy basate su `profiles.role = 'ADMIN'`

### 4. Prenotazioni e pagamenti

| Componente | Path | Funzione |
|------------|------|----------|
| Hold slot (canonico) | `src/app/_actions/bookings.ts` → `holdSlot` | Transazione Serializable: check slot + create booking |
| Checkout Stripe | `…` → `createStripeCheckoutSession` | Session Stripe con `price_data` server-side |
| Checkout unificato (nuovo) | `src/app/actions/booking-checkout.ts` | Hold+checkout; transazione atomica post-audit |
| Webhook | `src/app/api/webhook/stripe/route.ts` | Firma + idempotenza + fulfillment |
| Pricing | `src/app/_lib/bookings/pricing.ts` | `resolvePricingTier(participantCount)` |

### 5. Operazioni (Vercel)

| Componente | Path | Funzione |
|------------|------|----------|
| Keep-alive | `src/app/api/cron/keep-alive/route.ts` | Query `SELECT 1` ogni 5 giorni |
| Schedule | `vercel.json` | Cron + header Bearer da `CRON_SECRET` |

---

## Tag audit inline (riferimento codice)

Cerca nel repo: `⚠️ CRITICAL SECURITY CHECK`

| Tag | Significato | Dove |
|-----|-------------|------|
| `[ENV_LEAK]` | Nessuna secret key nel bundle browser | `src/utils/supabase/*.ts`, `src/lib/prisma.ts` |
| `[COOKIE_HANDLING]` | Cookie mutation sicura (try/catch in RSC) | `server.ts`, `proxy.ts` |
| `[TOKEN_VALIDATION]` | Solo `getUser()`, vietato `getSession()` | `proxy.ts`, `dal.ts`, `auth-validation.ts` |
| `[DB_RLS]` | RLS abilitato e forzato | `supabase/migrations/00_init_auth_and_rls.sql` |
| `[SECURITY_DEFINER]` | `search_path` bloccato su trigger | funzione `handle_new_user()` |
| `[WEBHOOK_SECURITY]` | Firma Stripe + idempotenza WRITE-FIRST | `webhook/stripe/route.ts` |
| `[WEBHOOK_IDEMPOTENCY]` | Insert `StripeWebhookEvent` prima della logica | `claimWebhookEvent()` |
| `[PAYMENT_INTEGRITY]` | Prezzi da `RoomPricingTier`, mai dal client | actions booking |
| `[IDOR_PREVENTION]` | `userId` solo da sessione validata | `dal.ts`, actions |
| `[CONCURRENCY_PROTECTION]` | `$transaction` Serializable su hold | `holdSlot`, `booking-checkout.ts` |
| `[RATE_LIMITING]` | Validazione `CRON_SECRET` timing-safe | `cron/keep-alive/route.ts` |
| `[ROUTE_PROTECTION]` | Open redirect defense | `auth/callback/route.ts` |

---

## Checklist validazione manuale (pre-deploy)

> Copia operativa — dettaglio esteso in [`ROADMAP.md`](./ROADMAP.md#-checklist-validazione-sicurezza-manuale)

### Auth & edge

- [ ] `src/proxy.ts`: grep `getSession` → **zero chiamate** (solo commenti ammessi)
- [ ] `src/utils/supabase/client.ts`: grep `SERVICE_ROLE` → **zero**
- [ ] `npm run build` + verifica chunk client senza `DATABASE_URL` / `STRIPE_SECRET_KEY`
- [ ] Login reale → callback → profilo creato in `profiles` (trigger DB)
- [ ] Redirect malicious `?next=//evil.com` → fallback sicuro
- [ ] Dashboard Supabase: Site URL + Redirect URLs = `NEXT_PUBLIC_APP_URL` + `/auth/callback`

### Database RLS

- [ ] SQL `00_init_auth_and_rls.sql` applicato su staging/prod
- [ ] `\d+ profiles` → `rowsecurity = true`, `forcerowsecurity = true`; colonna `role` presente
- [ ] Test anon key Supabase: INSERT su `Booking` → **negato**
- [ ] Utente A non legge booking utente B via REST

### Pagamenti

- [ ] `holdSlot`: due request concorrenti stesso slot → una sola vince
- [ ] Webhook: replay stesso `event.id` → HTTP 200 duplicate, nessuna doppia mutazione
- [ ] Webhook: body alterato → 400 invalid signature
- [ ] Importo Stripe ≠ atteso → `PAYMENT_CONFLICT_REFUND_REQUIRED`, Payment tracciato
- [ ] `npx tsx scripts/audit-stripe-payment-flows.ts` → PASS (`prisma.profile`)

### Cron

- [ ] `CRON_SECRET` impostato su Vercel (≥ 32 caratteri)
- [ ] Request senza header → 401
- [ ] Request con secret corretto → 200 + log keep-alive

### Legacy cleanup

- [x] Rimosso `src/app/api/auth/[...better-auth]/route.ts`
- [x] `proxy.ts` migrato a Supabase (non più cookie Better Auth)
- [x] Rimosso `src/lib/auth-client.ts`
- [x] Build senza dipendenza `better-auth` in `package.json`
- [ ] Dead code: `src/app/_lib/auth/email.ts`, lockout no-op
- [ ] Fallback callback `/dashboard` → path esistente (`/` o `/account`)

---

## Modifiche apportate

### Changelog 2026-08-21

| Area | Modifica | File principali |
|------|----------|-----------------|
| SQL | `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role` prima delle policy admin | `00_init_auth_and_rls.sql` |
| Audit Stripe | `prisma.profiles` → `prisma.profile` | `scripts/audit-stripe-payment-flows.ts` |
| Env | Rimosse `BETTER_AUTH_*`; aggiunte Supabase + `CRON_SECRET` | `src/app/_lib/env.ts`, `.env.example` |
| Docs | Roadmap / audit / struttura allineati a `proxy.ts` | `ROADMAP.md`, questo file, `PROJECT_STRUCTURE.md` |

### Changelog 2026-08-20

| Area | Modifica | File principali |
|------|----------|-----------------|
| Schema | `User` → `Profile`, purge Session/Account/Verification | `prisma/schema.prisma` |
| RLS | Trigger + policy + FORCE RLS | `supabase/migrations/00_init_auth_and_rls.sql` |
| Supabase SSR | Client browser/server tipizzati | `src/utils/supabase/*` |
| Prisma | Client globale pooled | `src/lib/prisma.ts` |
| DAL | Sessione via `getUser()` + `profiles` | `src/lib/dal.ts` |
| Edge | Proxy Supabase (Next.js 16) | `src/proxy.ts` |
| Auth | Callback PKCE | `src/app/auth/callback/route.ts` |
| Webhook | Tag audit + import `@/lib/prisma` | `src/app/api/webhook/stripe/route.ts` |
| Cron | Keep-alive + timing-safe secret | `src/app/api/cron/keep-alive/route.ts`, `vercel.json` |
| Booking | Action checkout con transazione atomica | `src/app/actions/booking-checkout.ts` |
| UI | Login/signup/account Supabase | `src/components/horror/auth/*`, `_actions/account.ts` |

---

## Rischi residui e backlog sicurezza

| Rischio | Mitigazione attuale | Azione |
|---------|---------------------|--------|
| Due client Prisma | Import inconsistenti (`@/lib/prisma` vs `@/app/_lib/prisma`) | Migrare tutto a `@/lib/prisma` |
| Due action checkout | Possibile drift logica | Unificare `holdSlot` + `booking-checkout` |
| RLS non applicato | Prisma bypassa RLS con connection diretta | Applicare SQL + test REST |
| `00_hardened_auth_rls.sql` vs `00_init_*` | Conflitto se entrambi eseguiti | Scegliere **solo** `00_init_auth_and_rls.sql` |
| Admin role in proxy | Nessun check `ADMIN` all'edge | Resta su `requireAdmin()` server-side ✅ |
| `validateAdminSession()` | Legge `user_metadata.role` / `app_metadata`, non `profiles.role` | Non usarla per gate admin; usare `requireAdmin()` |
| Callback fallback `/dashboard` | Rotta inesistente | Cambiare fallback a `/` o `/account` |
| Matcher `proxy` esclude `api/auth` | Residuo Better Auth (route già rimossa) | Pulire matcher |

---

## Env secrets (matrice esposizione)

Dettaglio e **dove trovare i valori:** [`.env.example`](./.env.example) e tabella in [`ROADMAP.md`](./ROADMAP.md).

| Variabile | Browser | Server | Note |
|-----------|---------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Pubblico — Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Pubblico — Settings → API `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **MAI** | ⚠️ non usata dal codice | Bypass RLS |
| `DATABASE_URL` | ❌ | ✅ | Prisma — Settings → Database |
| `STRIPE_SECRET_KEY` | ❌ | ✅ | Checkout/webhook |
| `STRIPE_WEBHOOK_SECRET` | ❌ | ✅ | Solo route webhook |
| `CRON_SECRET` | ❌ | ✅ | Generata da te; Vercel env + Bearer cron |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | Dominio pubblico, non `*.vercel.app` |
| `RESEND_*` | ❌ | ✅ | Contatti/ops; Auth email = dashboard Supabase |

---

## Prossima revisione audit

- **Data consigliata:** dopo apply SQL + Prisma migrate su staging + env Vercel compilate
- **Reviewer:** verificare checklist manuale sopra
- **Automazione:** mantenere `scripts/audit-stripe-payment-flows.ts` in CI

---

*Aggiornare insieme a `ROADMAP.md` ad ogni change significativo.*
