# Checklist pubblicazione — Cage Room

Documento operativo: cosa devi completare **manualmente** prima di considerare il sito realmente pubblicabile in produzione.

Ultimo aggiornamento: riferito allo stato attuale del repository.

---

## Blocchi critici (da fare per primi)

### 2. File `.env` di produzione

**File:** `.env` (locale, **non** committato — vedi [`.gitignore`](.gitignore))

Non esiste un `.env.example` tracciato in repo (ignorato dal pattern `.env*`). Usa [`src/app/_lib/env.ts`](src/app/_lib/env.ts) come riferimento per le variabili obbligatorie.

| Variabile | Obbligatoria | Dove configurarla | Note |
|-----------|--------------|-------------------|------|
| `DATABASE_URL` | Sì | Neon / Vercel Postgres | Connection string PostgreSQL |
| `BETTER_AUTH_SECRET` | Sì | Genera 32+ caratteri random | Mai committare |
| `BETTER_AUTH_URL` | Sì | URL pubblico del sito | **Deve coincidere** con `NEXT_PUBLIC_APP_URL` |
| `NEXT_PUBLIC_APP_URL` | Sì | Es. `https://www.cageroom.it` | Usato da metadata, Stripe return URL, sitemap |
| `STRIPE_SECRET_KEY` | Sì | Dashboard Stripe | `sk_test_...` in test, `sk_live_...` in produzione |
| `STRIPE_WEBHOOK_SECRET` | Sì | Dashboard Stripe → Webhooks | Diverso per test e live |
| `RESEND_API_KEY` | No* | resend.com | *Obbligatoria se vuoi email funzionanti |
| `RESEND_FROM_EMAIL` | No* | Es. `noreply@tuodominio.it` | *Senza dominio verificato Resend, reset password e contatti non arrivano agli utenti reali |
| `CONTACT_EMAIL_TO` | No* | Email staff | Destinatario form contatti |
| `STRIPE_OPS_EMAIL_TO` | No | Email staff | Alert conflitti pagamento Stripe |
| `NODE_ENV` | Auto | Vercel imposta `production` | — |

**Su Vercel:** Project → Settings → Environment Variables (imposta almeno Production; consigliato anche Preview con valori di test).

---

## File e asset da inserire o sostituire tu

### PDF liberatoria (download)

| Cosa | Percorso |
|------|----------|
| **File da sostituire** | [`public/documents/liberatoria.pdf`](public/documents/liberatoria.pdf) |
| **URL pubblico** | `https://tuodominio.it/documents/liberatoria.pdf` |
| **Link nel codice** | [`src/components/horror/booking/BookingWidget.tsx`](src/components/horror/booking/BookingWidget.tsx) (bottone «Scarica PDF») |

Sostituisci il PDF con il **modulo legale definitivo** (firmabile/stampabile), mantenendo lo stesso nome file oppure aggiornando `href` e `download` nel componente.

---

### Logo e icone (favicon / social preview)

Al momento **non c’è un logo immagine**: in navbar compare solo il testo «Cage Room» ([`src/components/horror/SiteNavClient.tsx`](src/components/horror/SiteNavClient.tsx)).

| Asset | Percorso consigliato (Next.js App Router) | Effetto |
|-------|-------------------------------------------|---------|
| **Favicon** | `src/app/favicon.ico` oppure `src/app/icon.png` | Icona tab browser |
| **Apple touch icon** | `src/app/apple-icon.png` | iOS home screen |
| **Open Graph** | `src/app/opengraph-image.png` (1200×630) | Anteprima link su social/WhatsApp |
| **Logo in navbar** (opzionale) | Aggiungi `<Image>` in `SiteNavClient.tsx` + file in `public/brand/logo.svg` | Brand visivo |

Metadata globali: [`src/app/layout.tsx`](src/app/layout.tsx) — oggi senza `openGraph.images` custom.

---



### Stripe (test e poi live)

**Codice rilevante:**

| Area | File |
|------|------|
| Client Stripe | [`src/app/_lib/stripe.ts`](src/app/_lib/stripe.ts) |
| Checkout session | [`src/app/_actions/bookings.ts`](src/app/_actions/bookings.ts) |
| Webhook | [`src/app/api/webhook/stripe/route.ts`](src/app/api/webhook/stripe/route.ts) |
| Success page | [`src/app/checkout/success/page.tsx`](src/app/checkout/success/page.tsx) |

**Setup dashboard Stripe:**

1. Account Stripe attivato (dati azienda, conto bancario per live)
2. **Modalità test** — chiavi `sk_test_...` e webhook di test
3. **Webhook endpoint:**  
   `https://tuodominio.it/api/webhook/stripe`  
   Eventi minimi consigliati: `checkout.session.completed`, `checkout.session.expired` (verifica in Stripe CLI / dashboard quali gestisce il route handler)
4. Copia **Signing secret** → `STRIPE_WEBHOOK_SECRET`
5. Test locale webhook (opzionale):

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

**Carte di test Stripe (modalità test):**

| Scenario | Numero carta |
|----------|----------------|
| Pagamento OK | `4242 4242 4242 4242` |
| Pagamento rifiutato | `4000 0000 0000 0002` |
| 3D Secure | `4000 0025 0000 3155` |

Scadenza/CVC: qualsiasi futura / qualsiasi 3 cifre.

**Checklist test Stripe (da fare in test mode):**

- [ ] Prenotazione → hold slot → redirect Checkout → pagamento completo
- [ ] Pagamento caparra vs saldo completo
- [ ] Ritorno su `/checkout/success?session_id=...`
- [ ] Webhook ricevuto (booking passa a `PAID` / `DEPOSIT_PAID`)
- [ ] Annullamento da `/account` con rimborso (oltre 48h dall’evento)
- [ ] Annullamento admin con rimborso
- [ ] Hold scaduto → slot di nuovo libero

**Go-live:** sostituisci chiavi test con `sk_live_...`, ricrea webhook su URL produzione, aggiorna `STRIPE_WEBHOOK_SECRET` live.

---

### Email (Resend)

**Codice:**

| Funzione | File |
|----------|------|
| Reset password | [`src/app/_lib/auth/email.ts`](src/app/_lib/auth/email.ts) |
| Form contatti | [`src/app/_lib/contact/email.ts`](src/app/_lib/contact/email.ts) |
| Alert operativi Stripe | [`src/app/_lib/ops-alert.ts`](src/app/_lib/ops-alert.ts) |
| From address | [`src/app/_lib/email/shared.ts`](src/app/_lib/email/shared.ts) |

**Passi:**

1. Account [resend.com](https://resend.com) + API key → `RESEND_API_KEY`
2. **Verifica dominio** (DNS SPF/DKIM) su Resend
3. Imposta `RESEND_FROM_EMAIL=noreply@tuodominio.it` (o simile)
4. Imposta `CONTACT_EMAIL_TO` e opzionale `STRIPE_OPS_EMAIL_TO`

**Senza dominio verificato:** Resend consegna solo all’email del proprietario account (sandbox) — insufficiente in produzione.

**Test:**

- [ ] `/forgot-password` → email con link reset
- [ ] `/contatti` → messaggio arriva a `CONTACT_EMAIL_TO`
- [ ] Simula conflitto pagamento → alert a ops (se configurato)

---

## Contenuti e dati da completare in admin / codice

### Da pannello admin (dopo login ADMIN)

| Sezione | URL | Cosa inserire |
|---------|-----|---------------|
| Stanze | `/admin/rooms` | Stanze reali, descrizioni, prezzi, tier partecipanti, terror level |
| Calendario | `/admin/schedule` | Chiusure, orari speciali, festività |
| Recensioni | `/admin/reviews` | Recensioni vere (sostituire quelle seed) |
| Prenotazioni | `/admin/bookings` | Monitoraggio post-lancio |
| Contatti | `/admin/contatti` | Messaggi dal form |
| Impostazioni | `/admin/impostazioni` | Easter egg sconto (`/maledizione`) on/off |

---

### Testi placeholder da sostituire con dati reali

| Contenuto | File | Cosa cambiare |
|-----------|------|---------------|
| Indirizzo fittizio | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) | «Via del Manicomio 13, 00100 Roma» |
| Orari segreteria | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) | Orari reali |
| Mappa | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) | Placeholder «Mappa stilizzata» → embed Google Maps o immagine |
| Link social | [`src/app/_lib/site/social.ts`](src/app/_lib/site/social.ts) | Instagram, Facebook, TikTok, **WhatsApp** (`393000000000` è placeholder) |
| FAQ annullamento | [`src/app/page.tsx`](src/app/page.tsx) | Oggi dice «contatta lo staff»; esiste già annullamento self-service in `/account` — allinea il testo |
| JSON-LD SEO | [`src/app/page.tsx`](src/app/page.tsx) | Aggiungi indirizzo, telefono, geo, `image` se hai logo |
| Lore «Chi siamo» | [`src/app/about/page.tsx`](src/app/about/page.tsx) | Narrativa horror OK per brand, verifica coerenza con realtà locale |

**Nota link Instagram:** `vercel.json` punta a `cageroom.it`, [`social.ts`](src/app/_lib/site/social.ts) punta a `instagram.com/cageroom` — allinea handle e URL.

---

## Pagine legali (non presenti oggi)

Da valutare prima del go-live commerciale:

- [ ] Privacy policy (`/privacy` o PDF)
- [ ] Cookie policy / banner cookie (se usi Analytics non essenziali)
- [ ] Termini e condizioni di prenotazione / recesso

Non ci sono route dedicate nel progetto: vanno create o linkate dal footer ([`src/components/horror/SiteFooter.tsx`](src/components/horror/SiteFooter.tsx)).

---

## Deploy su Vercel

1. Collega repo GitHub a Vercel
2. Imposta env vars (sezione sopra)
3. **Rimuovi redirect Instagram** da `vercel.json`
4. Dominio custom → aggiorna `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL`
5. Build command: `npm run build` (default)
6. Post-deploy:

```bash
npx prisma migrate deploy   # da CI o manualmente con DATABASE_URL produzione
```

7. Verifica:
   - [ ] Home, stanze, prenotazione, login
   - [ ] `/sitemap.xml` e `/robots.txt` con URL produzione ([`src/app/sitemap.ts`](src/app/sitemap.ts), [`src/app/robots.ts`](src/app/robots.ts))
   - [ ] HTTPS e cookie sessione (Better Auth)

---

## Checklist test end-to-end pre-lancio

### Account e auth
- [ ] Registrazione, login, logout
- [ ] Modifica profilo (nome, avatar, telefono)
- [ ] Cambio password
- [ ] Reset password via email

### Prenotazione
- [ ] Selezione data/slot su `/rooms/[slug]`
- [ ] Minorenni → download PDF + upload liberatoria
- [ ] Hold 10 minuti e scadenza
- [ ] Checkout Stripe (test mode)
- [ ] Email/UX successo checkout

### Admin
- [ ] CRUD stanza
- [ ] Override calendario
- [ ] Visualizza/scarica liberatoria uploadata ([`src/app/api/admin/waivers/[waiverId]/route.ts`](src/app/api/admin/waivers/[waiverId]/route.ts))
- [ ] Annullamento prenotazione con rimborso

### Sicurezza / ops
- [ ] Rate limit attivo (DB Neon raggiungibile in prod — vedi [`src/app/_lib/rate-limit.ts`](src/app/_lib/rate-limit.ts))
- [ ] Webhook Stripe firma valida
- [ ] Route `/admin` negata a utenti non ADMIN

---

## Riepilogo file «metti il tuo file qui»

| Cosa | Percorso |
|------|----------|
| PDF liberatoria | `public/documents/liberatoria.pdf` |
| Favicon | `src/app/favicon.ico` o `src/app/icon.png` |
| Open Graph | `src/app/opengraph-image.png` |
| Logo (opzionale) | `public/brand/logo.svg` + modifica nav |
| Avatar | `public/avatars/<nome>.svg` + `src/app/_lib/account/avatars.ts` |
| Env produzione | Vercel dashboard (non in repo) |
| `.env` locale | root progetto (gitignored) |

---

## Dopo la pubblicazione

- Passa Stripe da **test** a **live**
- Verifica dominio email Resend in produzione
- Monitora `/admin/bookings` e alert `STRIPE_OPS_EMAIL_TO`
- Disabilita o adatta seed/demo (`prisma/seed.ts`) se non vuoi dati fittizi in DB produzione
