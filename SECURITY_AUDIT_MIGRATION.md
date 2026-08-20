# Security Audit & Migration — Master Document

**Progetto:** Cage Escape Room (`cageroom_3.0`)  
**Ultimo aggiornamento:** 2026-08-20  
**Scope:** Migrazione Better Auth → Supabase, RLS Postgres, hardening pagamenti, edge auth, cron ops  

Documenti correlati:
- [`ROADMAP.md`](./ROADMAP.md) — fasi, backlog, **checklist manuale pre-deploy**
- [`CONCURRENCY_AUDIT_REPORT.md`](./CONCURRENCY_AUDIT_REPORT.md) — race condition booking
- [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — indice file e rotte

---

## Executive summary

La migrazione introduce **defense-in-depth** su tre piani:

1. **Edge / Auth** — Supabase `getUser()` (mai `getSession()`), callback PKCE, middleware fail-closed  
2. **Database** — RLS FORCE su tabelle sensibili, trigger profilo con `search_path` bloccato  
3. **Pagamenti** — prezzi solo server-side, webhook idempotente WRITE-FIRST, hold atomico Serializable  

**Stato:** implementazione **parziale** — infrastruttura Supabase pronta; restano file legacy Better Auth (`proxy.ts`, route auth) da rimuovere prima del go-live.

---

## Parti del progetto (spiegazione)

### 1. Autenticazione (Supabase)

| Componente | Path | Funzione |
|------------|------|----------|
| Client browser | `src/utils/supabase/client.ts` | Login/signup lato client con anon key |
| Client server | `src/utils/supabase/server.ts` | Server Components / Actions con cookie |
| Callback PKCE | `src/app/auth/callback/route.ts` | Scambia `code` → sessione; sanitizza redirect |
| Middleware edge | `src/middleware.ts` | Refresh token, protegge `/account`, `/checkout`, `/admin`, … |
| DAL | `src/lib/dal.ts` | Unica fonte sessione server-side per pages/actions |

**Flusso:** utente fa login → redirect OAuth/PKCE → `/auth/callback` → cookie → middleware valida con `getUser()` → DAL legge profilo da `profiles`.

### 2. Database applicativo (Prisma)

| Componente | Path | Funzione |
|------------|------|----------|
| Schema | `prisma/schema.prisma` | Modelli business (`Profile`, `Booking`, …) |
| Client | `src/lib/prisma.ts` | Connessione pooled server-side |
| Migrazioni | `prisma/migrations/` | Evoluzione schema (include storico Better Auth) |

Prisma gestisce **tutta la business logic** (booking, pagamenti, admin). Supabase RLS aggiunge un secondo strato se qualcuno accede al DB via REST con anon key.

### 3. Sicurezza Postgres (Supabase RLS)

| Componente | Path | Funzione |
|------------|------|----------|
| Init RLS | `supabase/migrations/00_init_auth_and_rls.sql` | Trigger `handle_new_user`, policy, FORCE RLS |
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
| Keep-alive | `src/app/api/cron/keep-alive/route.ts` | Query leggera ogni 5 giorni |
| Schedule | `vercel.json` | Cron + `CRON_SECRET` |

---

## Tag audit inline (riferimento codice)

Cerca nel repo: `⚠️ CRITICAL SECURITY CHECK`

| Tag | Significato | Dove |
|-----|-------------|------|
| `[ENV_LEAK]` | Nessuna secret key nel bundle browser | `src/utils/supabase/*.ts`, `src/lib/prisma.ts` |
| `[COOKIE_HANDLING]` | Cookie mutation sicura (try/catch in RSC) | `server.ts`, `middleware.ts` |
| `[TOKEN_VALIDATION]` | Solo `getUser()`, vietato `getSession()` | `middleware.ts`, `dal.ts` |
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

- [ ] `src/middleware.ts`: grep `getSession` → **zero chiamate** (solo commenti ammessi)
- [ ] `src/utils/supabase/client.ts`: grep `SERVICE_ROLE` → **zero**
- [ ] `npm run build` + verifica chunk client senza `DATABASE_URL` / `STRIPE_SECRET_KEY`
- [ ] Login reale → callback → profilo creato in `profiles` (trigger DB)
- [ ] Redirect malicious `?next=//evil.com` → fallback sicuro

### Database RLS

- [ ] SQL `00_init_auth_and_rls.sql` applicato su staging/prod
- [ ] `\d+ profiles` → `rowsecurity = true`, `forcerowsecurity = true`
- [ ] Test anon key Supabase: INSERT su `Booking` → **negato**
- [ ] Utente A non legge booking utente B via REST

### Pagamenti

- [ ] `holdSlot`: due request concorrenti stesso slot → una sola vince
- [ ] Webhook: replay stesso `event.id` → HTTP 200 duplicate, nessuna doppia mutazione
- [ ] Webhook: body alterato → 400 invalid signature
- [ ] Importo Stripe ≠ atteso → `PAYMENT_CONFLICT_REFUND_REQUIRED`, Payment tracciato
- [ ] `npx tsx scripts/audit-stripe-payment-flows.ts` → PASS

### Cron

- [ ] `CRON_SECRET` impostato su Vercel
- [ ] Request senza header → 401
- [ ] Request con secret corretto → 200 + log keep-alive

### Legacy cleanup (bloccante go-live)

- [ ] Rimosso `src/app/api/auth/[...better-auth]/route.ts`
- [ ] Rimosso / sostituito `proxy.ts` (Better Auth cookie)
- [ ] Rimosso `src/lib/auth-client.ts`
- [ ] Build senza dipendenza `better-auth` in `package.json` ✅ (già rimossa)

---

## Modifiche apportate (changelog 2026-08-20)

| Area | Modifica | File principali |
|------|----------|-----------------|
| Schema | `User` → `Profile`, purge Session/Account/Verification | `prisma/schema.prisma` |
| RLS | Trigger + policy + FORCE RLS | `supabase/migrations/00_init_auth_and_rls.sql` |
| Supabase SSR | Client browser/server tipizzati | `src/utils/supabase/*` |
| Prisma | Client globale pooled | `src/lib/prisma.ts` |
| DAL | Sessione via `getUser()` + `profiles` | `src/lib/dal.ts` |
| Edge | Middleware Supabase | `src/middleware.ts` |
| Auth | Callback PKCE | `src/app/auth/callback/route.ts` |
| Webhook | Tag audit + import `@/lib/prisma` | `src/app/api/webhook/stripe/route.ts` |
| Cron | Keep-alive + timing-safe secret | `src/app/api/cron/keep-alive/route.ts`, `vercel.json` |
| Booking | Action checkout con transazione atomica | `src/app/actions/booking-checkout.ts` |
| UI | Login/signup Supabase | `src/components/horror/auth/*` |
| Docs | Audit concorrenza | `CONCURRENCY_AUDIT_REPORT.md` |

---

## Rischi residui e backlog sicurezza

| Rischio | Mitigazione attuale | Azione |
|---------|---------------------|--------|
| Doppio gate auth (proxy + middleware) | Comportamento imprevedibile | Unificare in `src/middleware.ts` |
| Due client Prisma | Import inconsistenti | Migrare tutto a `@/lib/prisma` |
| Due action checkout | Possibile drift logica | Unificare `holdSlot` + `booking-checkout` |
| RLS non applicato | Prisma bypassa RLS con connection diretta | Applicare SQL + test REST |
| `00_hardened_auth_rls.sql` vs `00_init_*` | Conflitto se entrambi eseguiti | Scegliere una migrazione |
| Admin role in middleware | Solo commento, non enforcement edge | Resta su `requireAdmin()` server-side ✅ |

---

## Env secrets (matrice esposizione)

| Variabile | Browser | Server | Note |
|-----------|---------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Pubblico |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | RLS obbligatoria |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **MAI** | ⚠️ solo se necessario | Bypass RLS |
| `DATABASE_URL` | ❌ | ✅ | Prisma |
| `STRIPE_SECRET_KEY` | ❌ | ✅ | Checkout/webhook |
| `STRIPE_WEBHOOK_SECRET` | ❌ | ✅ | Solo route webhook |
| `CRON_SECRET` | ❌ | ✅ | Solo route cron |

---

## Prossima revisione audit

- **Data consigliata:** dopo completamento Fase K (purge Better Auth) + deploy staging
- **Reviewer:** verificare checklist manuale sopra
- **Automazione:** mantenere `scripts/audit-stripe-payment-flows.ts` in CI

---

*Documento generato nell'ambito della migrazione sicurezza 2026-08-20. Aggiornare insieme a `ROADMAP.md` ad ogni change significativo.*
