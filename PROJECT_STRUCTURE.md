# Cage Escape Room — struttura del progetto

Indice delle rotte, moduli di sicurezza e flussi dati.  
Stack: **Next.js 16** · **Prisma 7** · **Supabase Auth** (migrazione in corso) · **Stripe** · **PostgreSQL**

> Ultimo aggiornamento: **2026-08-20** — vedi anche `ROADMAP.md` e `SECURITY_AUDIT_MIGRATION.md`.

---

## Mappa ad alto livello

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  LoginForm / SignupForm → @supabase/ssr createBrowserClient │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Edge: src/middleware.ts (Supabase getUser, rotte protette)  │
│  Legacy: proxy.ts (Better Auth cookie — da rimuovere)        │
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
| `src/middleware.ts` | Solo `getUser()`, mai `getSession()` |
| `src/lib/dal.ts` | Sessione server-side per IDOR prevention |
| `src/components/horror/auth/LoginForm.tsx` | Flusso login Supabase |
| `src/components/horror/auth/SignupForm.tsx` | Metadata profilo (name, phone, username) |
| `src/components/horror/auth/LogoutButton.tsx` | Logout lato client |

### Auth — legacy da rimuovere ⚠️

| File | Stato |
|------|--------|
| `proxy.ts` | Gate Better Auth + manutenzione — **sostituire con middleware unificato** |
| `src/app/api/auth/[...better-auth]/route.ts` | Route Better Auth — **eliminare** |
| `src/lib/auth-client.ts` | Client Better Auth — **eliminare** |

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

> Ogni `page.tsx` sotto `/admin` deve chiamare `requireAdmin()` (partial rendering Next.js).

## API Route Handlers

| Rotta | File | Scopo |
|-------|------|--------|
| `/auth/callback` | `src/app/auth/callback/route.ts` | OAuth/PKCE Supabase |
| `/api/webhook/stripe` | `src/app/api/webhook/stripe/route.ts` | Webhook Stripe **canonico** |
| `/api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Alias → stesso handler |
| `/api/cron/keep-alive` | `src/app/api/cron/keep-alive/route.ts` | Keep-alive DB (Vercel Cron) |
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
| `scripts/audit-stripe-payment-flows.ts` | Regressione automatizzata flussi Stripe |

## Database e sicurezza Postgres

| Path | Scopo |
|------|--------|
| `prisma/schema.prisma` | Modelli app: `Profile`, `Room`, `Booking`, `Payment`, … |
| `prisma/migrations/` | Migrazioni Prisma (storico Better Auth + business) |
| `supabase/migrations/00_init_auth_and_rls.sql` | Trigger profilo, FORCE RLS, policy |
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
| `src/middleware.ts` | **Gate Supabase** (target produzione) |
| `proxy.ts` | Gate legacy Better Auth + manutenzione |
| `vercel.json` | Cron keep-alive ogni 5 giorni |
| `src/app/sitemap.ts`, `robots.ts`, `manifest.ts` | SEO |

## Server Actions

| Modulo | Azioni | Note sicurezza |
|--------|--------|----------------|
| `src/app/_actions/bookings.ts` | `holdSlot`, `createStripeCheckoutSession`, `cancelMyBooking`, slot read | **Canonico** — transazione Serializable su hold |
| `src/app/actions/booking-checkout.ts` | `createBookingCheckout` | Nuovo — hold+checkout in un'action; transazione post-audit |
| `src/app/_actions/account.ts` | Profilo, password, delete account | Verificare mapping `Profile` |
| `src/app/_actions/maledizione.ts` | Codice sconto easter egg | |
| `src/app/_actions/admin/*` | CRUD admin | `requireAdmin` |
| `src/actions/auth.ts` | Prepare login/signup legacy | **Da migrare** su Supabase |
| `src/actions/contact.ts` | Form contatti | |

## Librerie condivise

| Path | Contenuto |
|------|-----------|
| `src/utils/supabase/` | Client browser/server Supabase SSR |
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
| `ROADMAP.md` | Roadmap vivente, fasi, checklist sicurezza manuale |
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
