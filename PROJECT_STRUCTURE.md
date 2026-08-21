# Cage Escape Room — struttura del progetto

Indice delle rotte, moduli di sicurezza e flussi dati.  
Stack: **Next.js 16** · **Prisma 7** · **Supabase Auth** · **Stripe** · **PostgreSQL**

> Ultimo aggiornamento: **2026-08-21** — vedi anche `ROADMAP.md`, `SECURITY_AUDIT_MIGRATION.md` e `.env.example`.

---

## Mappa ad alto livello

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  LoginForm / SignupForm → @supabase/ssr createBrowserClient │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Edge: src/proxy.ts (Next.js 16)                             │
│  getUser(), refresh cookie, manutenzione, rotte protette     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  App Router (src/app/)                                       │
│  Pages · Server Actions · Route Handlers                     │
└───────┬─────────────────────────────┬───────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────┐             ┌───────────────────┐
│ Prisma (app)  │             │ Supabase Auth     │
│ src/lib/      │             │ auth.users + RLS  │
│ prisma.ts     │             │ su public.*       │
└───────────────┘             └───────────────────┘
```

---

## Pagine pubbliche

| Rotta | File | Scopo |
|-------|------|--------|
| `/` | `src/app/page.tsx` | Homepage: hero, stanze, recensioni, FAQ, CTA |
| `/rooms` | `src/app/rooms/page.tsx` | Catalogo stanze |
| `/rooms/[slug]` | `src/app/rooms/[slug]/page.tsx` | Dettaglio + widget prenotazione |
| `/about` | `src/app/about/page.tsx` | Chi siamo |
| `/contatti` | `src/app/contatti/page.tsx` | Form contatti |
| `/privacy`, `/cookie`, `/termini` | rispettive `page.tsx` | Legale (placeholder / iubenda) |
| `/manutenzione` | `src/app/manutenzione/page.tsx` | Schermata manutenzione (prod) |
| `/maledizione` | `src/app/maledizione/page.tsx` | Easter egg → codice sconto |

## Auth e account

| Rotta | File | Scopo |
|-------|------|--------|
| `/login` | `src/app/login/page.tsx` | Accesso (Supabase client) |
| `/signup` | `src/app/signup/page.tsx` | Registrazione |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Reset password |
| `/reset-password` | `src/app/reset-password/page.tsx` | Nuova password |
| `/auth/callback` | `src/app/auth/callback/route.ts` | **PKCE callback** Supabase |
| `/account` | `src/app/account/page.tsx` | Profilo, prenotazioni, sicurezza |

### Auth — file da validare manualmente 🔐

| File | Perché controllarlo |
|------|---------------------|
| `src/utils/supabase/client.ts` | Solo chiavi `NEXT_PUBLIC_*`; niente service role |
| `src/utils/supabase/server.ts` | Cookie `setAll` in try/catch; stesse chiavi pubbliche |
| `src/app/auth/callback/route.ts` | `exchangeCodeForSession` + sanitizzazione redirect |
| `src/proxy.ts` | Solo `getUser()`, mai `getSession()`; manutenzione |
| `src/lib/dal.ts` | Sessione server-side per IDOR prevention (`profiles.role`) |
| `src/utils/supabase/auth-validation.ts` | Re-auth Server Action (`validateUserSession`) |
| `src/components/horror/auth/LoginForm.tsx` | Flusso login Supabase |
| `src/components/horror/auth/SignupForm.tsx` | Metadata profilo (name, phone, username) |
| `src/components/horror/auth/LogoutButton.tsx` | Logout lato client |

### Auth — già rimosso / non usare

| File | Stato |
|------|--------|
| `src/middleware.ts` | **Non esiste** — in Next.js 16 il gate è `src/proxy.ts` |
| `src/app/api/auth/[...better-auth]/route.ts` | Eliminata |
| `src/lib/auth-client.ts` | Eliminato |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Non più lette — togliere dal `.env` |

## Checkout

| Rotta | File | Scopo |
|-------|------|--------|
| `/checkout` | `src/app/checkout/page.tsx` | Pagamento hold esistente |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Conferma post-Stripe |

## Area admin (`requireAdmin`)

| Rotta | File | Scopo |
|-------|------|--------|
| `/admin` | `src/app/admin/page.tsx` | Dashboard |
| `/admin/bookings` | … | Prenotazioni |
| `/admin/rooms` | … | CRUD stanze + tier prezzo |
| `/admin/schedule` | … | Orari settimanali + override |
| `/admin/reviews` | … | Recensioni |
| `/admin/contatti` | … | Inbox messaggi |
| `/admin/impostazioni` | … | SiteSettings |

> Ogni `page.tsx` sotto `/admin` deve chiamare `requireAdmin()` (partial rendering Next.js). Il ruolo admin vive in `profiles.role`, non nei JWT metadata.

## API Route Handlers

| Rotta | File | Scopo |
|-------|------|--------|
| `/auth/callback` | `src/app/auth/callback/route.ts` | OAuth/PKCE Supabase |
| `/api/webhook/stripe` | `src/app/api/webhook/stripe/route.ts` | Webhook Stripe **canonico** |
| `/api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Alias → stesso handler |
| `/api/cron/keep-alive` | `src/app/api/cron/keep-alive/route.ts` | Keep-alive DB (Vercel Cron, `CRON_SECRET`) |
| `/api/media/rooms/[roomId]` | … | Cover stanza WebP |
| `/api/media/reviews/[reviewId]` | … | Immagine recensione |
| `/api/admin/media/*` | … | Upload admin |
| `/api/admin/waivers/[waiverId]` | … | Download liberatoria |

### Pagamenti — file da validare manualmente 🔐

| File | Perché controllarlo |
|------|---------------------|
| `src/app/api/webhook/stripe/route.ts` | Firma webhook, WRITE-FIRST su `StripeWebhookEvent`, fulfillment booking |
| `src/app/_actions/bookings.ts` | `holdSlot` (transazione Serializable), `createStripeCheckoutSession` |
| `src/app/actions/booking-checkout.ts` | Checkout alternativo con transazione atomica (post-audit) |
| `src/app/_lib/bookings/pricing.ts` | `resolvePricingTier` |
| `src/app/_lib/bookings/charge-amount.ts` | Importo addebito deposit/full |
| `scripts/audit-stripe-payment-flows.ts` | Regressione automatizzata flussi Stripe (`prisma.profile`) |

## Database e sicurezza Postgres

| Path | Scopo |
|------|--------|
| `prisma/schema.prisma` | Modelli app: `Profile`, `Room`, `Booking`, `Payment`, … |
| `prisma/migrations/` | Migrazioni Prisma (storico Better Auth + business) |
| `supabase/migrations/00_init_auth_and_rls.sql` | Trigger profilo, FORCE RLS, policy, colonna `role` |
| `supabase/migrations/00_hardened_auth_rls.sql` | Alternativa cleanup legacy — **non eseguire entrambe** |

### DB — file da validare manualmente 🔐

| File | Perché controllarlo |
|------|---------------------|
| `prisma/schema.prisma` | `Profile` UUID, relazioni `Booking.userId`, assenza modelli Session/Account |
| `supabase/migrations/00_init_auth_and_rls.sql` | RLS su profiles/Booking/Payment/BookingWaiver/DiscountCode/StripeWebhookEvent |
| `src/lib/prisma.ts` | Pool server-side, niente esposizione browser |

## Layout, edge e config

| File | Scopo |
|------|--------|
| `src/app/layout.tsx` | Root layout, nav, analytics, iubenda |
| `src/app/admin/layout.tsx` | Shell admin |
| `src/proxy.ts` | **Gate produzione** (Supabase + manutenzione) |
| `vercel.json` | Cron keep-alive ogni 5 giorni |
| `.env.example` | Template env + dove trovare i valori |
| `src/app/_lib/env.ts` | Validazione env all'avvio |
| `src/app/sitemap.ts`, `robots.ts`, `manifest.ts` | SEO |

## Server Actions

| Modulo | Azioni | Note sicurezza |
|--------|--------|----------------|
| `src/app/_actions/bookings.ts` | `holdSlot`, `createStripeCheckoutSession`, `cancelMyBooking`, slot read | **Canonico** — transazione Serializable su hold |
| `src/app/actions/booking-checkout.ts` | `createBookingCheckout` | Nuovo — hold+checkout in un'action; transazione post-audit |
| `src/app/_actions/account.ts` | Profilo, password, delete account | Supabase Auth + `validateUserSession` |
| `src/app/_actions/maledizione.ts` | Codice sconto easter egg | |
| `src/app/_actions/admin/*` | CRUD admin | `requireAdmin` |
| `src/actions/auth.ts` | prepareLogin/Signup + `supabase.auth.resend` | Lockout Better Auth è no-op |
| `src/actions/contact.ts` | Form contatti | Resend |

## Librerie condivise

| Path | Contenuto |
|------|-----------|
| `src/utils/supabase/` | Client browser/server Supabase SSR + `auth-validation.ts` |
| `src/lib/dal.ts` | `getCurrentSession`, `requireUser`, `requireAdmin` |
| `src/lib/prisma.ts` | PrismaClient cached (**preferito**) |
| `src/app/_lib/prisma.ts` | Duplicato legacy — migrare import |
| `src/app/_lib/env.ts` | Validazione env centralizzata |
| `src/app/_lib/rate-limit.ts` | Rate limiting Postgres |
| `src/app/_lib/bookings/` | Slot, pricing, schemi Zod, waiver |
| `src/app/_lib/stripe/` | Client Stripe, alert ops |
| `src/components/horror/` | UI pubblica |
| `src/components/admin/` | UI admin |
| `src/components/account/` | UI account |

## Documentazione progetto

| File | Contenuto |
|------|-----------|
| `ROADMAP.md` | Roadmap vivente, fasi, checklist sicurezza, **dove trovare le env** |
| `.env.example` | Template variabili + dashboard di origine |
| `SECURITY_AUDIT_MIGRATION.md` | Audit tag, checkpoint auth/payment/cron |
| `CONCURRENCY_AUDIT_REPORT.md` | Race condition booking, transazioni |
| `PROJECT_STRUCTURE.md` | Questo file — indice architettura |
| `AGENTS.md` / `CLAUDE.md` | Regole agent Next.js |

---

## Modello dati principale (post-migrazione)

| Modello | Tabella | Ruolo |
|---------|---------|--------|
| `Profile` | `profiles` | Utente app (FK → `auth.users.id` UUID) |
| `Room` | `Room` | Stanze escape |
| `RoomPricingTier` | `RoomPricingTier` | Prezzi per fascia partecipanti |
| `Booking` | `Booking` | Prenotazione + hold + stato pagamento |
| `Payment` | `Payment` | Pagamenti Stripe tracciati |
| `StripeWebhookEvent` | `stripe_webhook_event` | Idempotenza webhook |
| `DiscountCode` | `DiscountCode` | Codici sconto utente |
| `BookingWaiver` | `BookingWaiver` | PDF liberatoria minorenni |

---

*Per la checklist operativa pre-deploy, aprire `ROADMAP.md` → sezione «Checklist validazione sicurezza manuale».*
