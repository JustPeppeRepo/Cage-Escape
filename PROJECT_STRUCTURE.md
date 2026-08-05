# Cage Escape Room — struttura del progetto

Indice delle rotte App Router, API e azioni server.  
Stack: Next.js 16 (App Router) · Prisma · Better Auth · Stripe · Neon Postgres.

---

## Pagine pubbliche

| Rotta | File | Scopo |
|-------|------|--------|
| `/` | `src/app/page.tsx` | Homepage: hero, stanze, recensioni, FAQ, CTA, JSON-LD SEO |
| `/rooms` | `src/app/rooms/page.tsx` | Catalogo stanze escape room |
| `/rooms/[slug]` | `src/app/rooms/[slug]/page.tsx` | Dettaglio stanza + widget prenotazione |
| `/about` | `src/app/about/page.tsx` | Chi siamo (missione, visione, fondatore, team) |
| `/contatti` | `src/app/contatti/page.tsx` | Contatti, social e form messaggio |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy Policy (placeholder / iubenda) |
| `/cookie` | `src/app/cookie/page.tsx` | Cookie Policy (placeholder / iubenda) |
| `/termini` | `src/app/termini/page.tsx` | Termini e condizioni (placeholder / iubenda) |
| `/manutenzione` | `src/app/manutenzione/page.tsx` | Schermata manutenzione (solo se attiva in prod) |
| `/maledizione` | `src/app/maledizione/page.tsx` | Mini-gioco segreto → codice sconto (noindex) |

## Auth e account

| Rotta | File | Scopo |
|-------|------|--------|
| `/login` | `src/app/login/page.tsx` | Accesso |
| `/signup` | `src/app/signup/page.tsx` | Registrazione |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Richiesta reset password |
| `/reset-password` | `src/app/reset-password/page.tsx` | Imposta nuova password (`?token=`) |
| `/reset-password/[token]` | `src/app/reset-password/[token]/page.tsx` | Redirect al path canonico con query |
| `/account` | `src/app/account/page.tsx` | Area utente: profilo, prenotazioni, sicurezza |

## Checkout

| Rotta | File | Scopo |
|-------|------|--------|
| `/checkout` | `src/app/checkout/page.tsx` | Completamento pagamento hold (`?bookingId=`) |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Conferma post-Stripe + polling stato |

## Area admin (`requireAdmin`)

| Rotta | File | Scopo |
|-------|------|--------|
| `/admin` | `src/app/admin/page.tsx` | Dashboard metriche |
| `/admin/bookings` | `src/app/admin/bookings/page.tsx` | Elenco / annulla prenotazioni |
| `/admin/rooms` | `src/app/admin/rooms/page.tsx` | Elenco stanze |
| `/admin/rooms/new` | `src/app/admin/rooms/new/page.tsx` | Crea stanza |
| `/admin/rooms/[roomId]` | `src/app/admin/rooms/[roomId]/page.tsx` | Modifica stanza + fasce prezzo |
| `/admin/schedule` | `src/app/admin/schedule/page.tsx` | Orari settimanali e override |
| `/admin/reviews` | `src/app/admin/reviews/page.tsx` | CRUD recensioni |
| `/admin/contatti` | `src/app/admin/contatti/page.tsx` | Inbox messaggi contatto |
| `/admin/impostazioni` | `src/app/admin/impostazioni/page.tsx` | Impostazioni sito / easter egg |

## API Route Handlers

| Rotta | File | Scopo |
|-------|------|--------|
| `/api/auth/[...better-auth]` | `src/app/api/auth/[...better-auth]/route.ts` | Better Auth (login, session, reset, …) |
| `/api/webhook/stripe` | `src/app/api/webhook/stripe/route.ts` | Webhook Stripe (canonico) |
| `/api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Alias plurale → stesso handler |
| `/api/media/rooms/[roomId]` | `src/app/api/media/rooms/[roomId]/route.ts` | Cover stanza (WebP pubblico) |
| `/api/media/reviews/[reviewId]` | `src/app/api/media/reviews/[reviewId]/route.ts` | Immagine recensione pubblica |
| `/api/admin/media/rooms/[roomId]` | `src/app/api/admin/media/rooms/[roomId]/route.ts` | Upload/delete cover stanza |
| `/api/admin/media/reviews/[reviewId]` | `src/app/api/admin/media/reviews/[reviewId]/route.ts` | Upload/delete immagine recensione |
| `/api/admin/waivers/[waiverId]` | `src/app/api/admin/waivers/[waiverId]/route.ts` | Download waiver (admin) |

## SEO / metadata file conventions

| File | Scopo |
|------|--------|
| `src/app/sitemap.ts` | Sitemap XML dinamica |
| `src/app/robots.ts` | robots.txt |
| `src/app/manifest.ts` | Web app manifest |
| `src/app/opengraph-image.jpg` | Anteprima Open Graph (file statico) |
| `src/app/twitter-image.jpg` | Anteprima Twitter/X (file statico) |

## Layout e shell

| File | Scopo |
|------|--------|
| `src/app/layout.tsx` | Root: font, nav, floating CTA, Iubenda, analytics, security metadata |
| `src/app/admin/layout.tsx` | Shell admin + gate `requireAdmin` |
| `src/app/loading.tsx` | Skeleton caricamento globale |
| `proxy.ts` | Gate cookie/mantenimento (sostituisce middleware classico) |

## Server Actions (principali)

| Modulo | Azioni tipiche |
|--------|----------------|
| `src/actions/contact.ts` | Invio form contatti |
| `src/actions/auth.ts` | Prepare login/signup, resend verifica |
| `src/app/_actions/bookings.ts` | Slot, hold, checkout Stripe, cancel utente |
| `src/app/_actions/account.ts` | Password, reset, delete account |
| `src/app/_actions/maledizione.ts` | Generazione codice sconto |
| `src/app/_actions/admin/*` | Mutazioni admin (stanze, orari, booking, …) |

## Cartelle di supporto

| Path | Contenuto |
|------|-----------|
| `src/components/horror/` | UI sito pubblico (hero, booking, auth, …) |
| `src/components/admin/` | UI pannello admin |
| `src/components/account/` | UI area account |
| `src/app/_lib/` | Env, Prisma, rate-limit, booking, media, SEO |
| `src/lib/` | Auth Better Auth, DAL (`requireUser` / `requireAdmin`) |
| `scripts/` | `dev-preflight.mjs`, audit Stripe manuale |
| `prisma/` | Schema e migrazioni |

---

*Ultimo aggiornamento: cleanup struttura e indici JSDoc sulle `page.tsx`.*
