# Checklist pubblicazione — Cage Room

Cosa **manca davvero** prima del go-live.  
Presupposto: database Neon, migrate, admin e avatar profilo sono già a posto.

---

## Priorità alta (blocca o danneggia il lancio)

- [ ] **PDF liberatoria legale** → sostituisci [`public/documents/liberatoria.pdf`](public/documents/liberatoria.pdf)  
  Oggi c’è un PDF generato automaticamente con testo base, non un documento legale firmato dal tuo legale/commercialista.

- [ ] **Stripe in produzione** (se ora sei ancora in test)  
  - Vercel env: `STRIPE_SECRET_KEY` → `sk_live_...`  
  - Webhook live: `https://<tuodominio>/api/webhook/stripe`  
  - Vercel env: `STRIPE_WEBHOOK_SECRET` → signing secret del webhook **live**  
  - Rifai i test pagamento sull’ambiente live con importo reale minimo

- [ ] **Email Resend in produzione** (se reset password / contatti devono funzionare per tutti)  
  - Verifica dominio su Resend (DNS)  
  - Vercel env: `RESEND_FROM_EMAIL` (es. `noreply@cageroom.it`) — senza, resta il fallback `onboarding@resend.dev` che **non** consegna agli utenti reali  
  - Vercel env: `CONTACT_EMAIL_TO`, opzionale `STRIPE_OPS_EMAIL_TO`

- [ ] **URL produzione** su Vercel  
  - `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL` = URL definitivo (es. `https://www.cageroom.it`), devono coincidere  
  - Dopo il cambio: login, redirect Stripe e sitemap devono usare lo stesso dominio

---

## Placeholder nel codice — da sostituire con dati reali

### Contatti e social

| Cosa sostituire | Valore attuale | File |
|----------------|----------------|------|
| Indirizzo | `Via del Manicomio 13, 00100 Roma` | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) (righe 32–33) |
| Orari segreteria | `Lun–Dom 10:00–22:00` | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) (righe 36–37) — verifica che coincidano con gli orari di apertura reali (default booking: [`src/app/_lib/bookings/constants.ts`](src/app/_lib/bookings/constants.ts) `10–22`) |
| Mappa | Box finto «Mappa stilizzata — il buio conosce la strada» | [`src/app/contatti/page.tsx`](src/app/contatti/page.tsx) (righe 43–48) → embed Google Maps o immagine |
| Instagram | `https://www.instagram.com/cageroom` | [`src/app/_lib/site/social.ts`](src/app/_lib/site/social.ts) |
| Facebook | `https://www.facebook.com/cageroom` | [`src/app/_lib/site/social.ts`](src/app/_lib/site/social.ts) |
| TikTok | `https://www.tiktok.com/@cageroom` | [`src/app/_lib/site/social.ts`](src/app/_lib/site/social.ts) |
| **WhatsApp** | `https://wa.me/393000000000` (**numero finto**) | [`src/app/_lib/site/social.ts`](src/app/_lib/site/social.ts) |

### Homepage e SEO

| Cosa sostituire / completare | Valore attuale | File |
|------------------------------|----------------|------|
| FAQ annullamento | «contattando il nostro staff» | [`src/app/page.tsx`](src/app/page.tsx) (righe 35–37) — oggi l’utente può annullare da [`/account`](src/app/account/page.tsx) con rimborso (se >48h); allinea il testo |
| FAQ minorenni | menziona «modulo di responsabilità» generico | [`src/app/page.tsx`](src/app/page.tsx) (righe 25–27) — opzionale: citare download PDF + upload in prenotazione |
| JSON-LD LocalBusiness | solo `name`, `description`, `url`, `priceRange` | [`src/app/page.tsx`](src/app/page.tsx) (righe 54–62) — aggiungi indirizzo, telefono, `geo`, `image` quando hai logo |
| Open Graph / Twitter image | metadata senza immagine custom | [`src/app/layout.tsx`](src/app/layout.tsx) — serve file immagine (vedi sotto) |

### Testi narrativi (verifica coerenza, non necessariamente «sbagliati»)

| Contenuto | File | Nota |
|-----------|------|------|
| Hero «Manicomio» | [`src/components/horror/HeroClient.tsx`](src/components/horror/HeroClient.tsx) | Allinea al nome/descrizione delle stanze reali se non usi più «Il Manicomio» |
| Lore «Chi siamo» | [`src/app/about/page.tsx`](src/app/about/page.tsx) | Narrativa horror di brand — ok se voluta; verifica che non prometta cose false (indirizzo reale, servizi, età minima, ecc.) |

---

## Asset mancanti (file che non esistono ancora)

| Asset | Dove crearlo | Stato repo |
|-------|--------------|------------|
| Favicon | `src/app/favicon.ico` o `src/app/icon.png` | **Assente** |
| Apple touch icon | `src/app/apple-icon.png` | **Assente** |
| Anteprima social (OG) | `src/app/opengraph-image.png` (1200×630) | **Assente** — Twitter card è `summary_large_image` ma non c’è immagine |
| Logo in navbar | opz. `public/brand/logo.svg` + modifica [`SiteNavClient.tsx`](src/components/horror/SiteNavClient.tsx) | Solo testo «Cage Room» |

---

## Dati in database / admin (non nel codice)

Controlla in produzione se hai ancora dati demo del seed ([`prisma/seed.ts`](prisma/seed.ts)):

| Cosa | Dove sistemarlo | Seed attuale |
|------|-----------------|--------------|
| Recensioni homepage | [`/admin/reviews`](src/app/admin/reviews/page.tsx) | Marco T., Giulia R., Luca P. (fittizie) |
| Stanze e prezzi | [`/admin/rooms`](src/app/admin/rooms/page.tsx) | «Il Manicomio» + tier demo se non sovrascritti |
| Calendario chiusure | [`/admin/schedule`](src/app/admin/schedule/page.tsx) | festività, ferie, orari speciali |
| Easter egg sconto | [`/admin/impostazioni`](src/app/admin/impostazioni/page.tsx) | on/off e percentuale `/maledizione` |

---

## Pagine legali (non implementate)

Da creare e linkare dal footer ([`src/components/horror/SiteFooter.tsx`](src/components/horror/SiteFooter.tsx)):

- [ ] Privacy policy
- [ ] Cookie policy (+ banner se tratti Analytics come non essenziali)
- [ ] Termini prenotazione / recesso / condizioni minorenni

Vercel Analytics e Speed Insights sono già in [`src/app/layout.tsx`](src/app/layout.tsx).

---

## Pulizia opzionale repo

| Cosa | Dettaglio |
|------|-----------|
| Avatar orfani | `public/avatars/skull.svg` e `raven.svg` non sono in [`avatars.ts`](src/app/_lib/account/avatars.ts) — elimina o riaggiungi alla lista |
| `vercel.json` redirect Instagram | **Rimosso** dal repo — ok per il deploy del sito vero |

---

## Test finali prima di aprire al pubblico

### Pagamenti (Stripe test → poi live)

- [ ] Prenotazione completa: slot → hold → checkout → success
- [ ] Caparra vs saldo intero
- [ ] Webhook: booking `PAID` / `DEPOSIT_PAID`
- [ ] Minorenni: scarica PDF + upload liberatoria
- [ ] Annullamento `/account` con rimborso (>48h)
- [ ] Annullamento admin con rimborso

Carte test (solo modalità test): `4242 4242 4242 4242` — scadenza/CVC qualsiasi futura.

### Email

- [ ] `/forgot-password` → email all’utente reale (non solo al tuo account Resend)
- [ ] `/contatti` → messaggio su `CONTACT_EMAIL_TO`

### Smoke test sito

- [ ] `/`, `/rooms`, `/rooms/[slug]`, login, `/account`, `/checkout`
- [ ] `/sitemap.xml` e `/robots.txt` con dominio produzione
- [ ] Link social e WhatsApp aprono i profili/numeri corretti

---

## Riepilogo rapido «metti il file / cambia il testo qui»

| Tipo | Percorso o file |
|------|-----------------|
| PDF liberatoria | `public/documents/liberatoria.pdf` |
| Favicon / icon | `src/app/favicon.ico` o `icon.png` |
| OG image | `src/app/opengraph-image.png` |
| Indirizzo, orari, mappa | `src/app/contatti/page.tsx` |
| Social + WhatsApp | `src/app/_lib/site/social.ts` |
| FAQ + SEO JSON-LD | `src/app/page.tsx` |
| Env produzione | Vercel → Settings → Environment Variables |
| Contenuti business | `/admin` (stanze, recensioni, calendario) |
| Legale | nuove pagine + `SiteFooter.tsx` |
