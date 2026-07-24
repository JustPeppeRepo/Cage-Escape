# Stripe Integration Roadmap — Cage Room (prenotazioni)

Fonte di verità: codice in repo. Non SaaS / API key.

## Path webhook (importante)

| Path | Ruolo |
|------|--------|
| `/api/webhook/stripe` | Canonico (implementazione) |
| `/api/webhooks/stripe` | Alias (re-export) per CLI/doc che usano il plurale |

```bash
stripe listen --forward-to http://localhost:3000/api/webhook/stripe
# oppure
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Copia il `whsec_...` in `.env` come `STRIPE_WEBHOOK_SECRET`.

---

## Audit 2026-07-24 — Findings e stato

### Già solidi (pre-audit)

- [x] Hold slot 10 minuti (`HOLD_DURATION_MS`) + `releaseExpiredHolds`
- [x] Conferma pagamento in `prisma.$transaction` + `Serializable`
- [x] Vincolo DB `booking_no_overlap_per_room` (EXCLUDE gist) su `PENDING|DEPOSIT_PAID|PAID`
- [x] `checkout.session.expired` → `CANCELLED` solo se ancora `PENDING` (`updateMany` guarded)
- [x] Firma webhook: `constructEvent` su raw body + `STRIPE_WEBHOOK_SECRET`
- [x] Prezzo solo server-side (`getBookingChargeAmount` / tier DB); metadata settati in `createStripeCheckoutSession`
- [x] Verifica valuta `eur`, metadata, importo, slot post-hold, sconto
- [x] Secret Stripe solo in `lib/env` / server modules (niente `NEXT_PUBLIC_STRIPE_*`)

### Fix applicati in questo audit

- [x] Tabella `stripe_webhook_event` per idempotenza su `event.id`
- [x] Alert ops via `after()` (non bloccano il 200 verso Stripe)
- [x] Confronto importi in **centesimi interi** (niente float/`0.01`)
- [x] Handler `charge.refunded`: rimborso totale → `Payment.REFUNDED` + `Booking.CANCELLED` (slot libero); parziale → alert ops, slot non liberato
- [x] `payment_intent.payment_failed`: **no-op intenzionale** (Checkout permette retry; liberazione via hold TTL / `session.expired`)
- [x] Alias `/api/webhooks/stripe`
- [x] Admin cancel: claim atomico `CANCELLED` **prima** dei refund (anti double-refund)
- [x] `getAvailableSlotsForRoom` chiama `releaseExpiredHolds` (allinea UI al vincolo EXCLUDE)
- [x] Copy success page: niente promessa di rimborso “automatico” fuorviante

### Backlog / prossimi step

- [ ] `charge.dispute.created`: congelare booking (es. stato dedicato o `PAYMENT_CONFLICT_REFUND_REQUIRED`) + alert ops
- [ ] Rimborso automatico Stripe sui rami `PAYMENT_CONFLICT_REFUND_REQUIRED` (oggi traccia + alert, refund manuale/admin)
- [ ] Stato `PaymentStatus.PARTIALLY_REFUNDED` se servono rimborsi parziali self-service
- [ ] Job periodico `releaseExpiredHolds` (oggi on-demand su hold/slots) per cleanup zombie PENDING
- [ ] Test e2e CI con Stripe test fixtures (opzionale)

---

## Guida test locale Stripe CLI

### 0. Prerequisiti

1. `npm run dev` su `:3000`
2. `stripe listen --forward-to http://localhost:3000/api/webhook/stripe`
3. Aggiorna `STRIPE_WEBHOOK_SECRET` con il whsec della CLI
4. Crea un hold reale (UI) oppure via Prisma Studio: un `Booking` `PENDING` con `holdExpiresAt` futuro, `paymentChoice` `FULL` o `DEPOSIT`, importo allineato al tier

Recupera ID:

```bash
npx tsx -e "import { PrismaClient } from './src/generated/prisma/client.ts'; /* oppure query SQL */"
# oppure in psql / Prisma Studio:
# SELECT id, "userId", "roomId", status, "paymentChoice", "totalAmount" FROM "Booking" WHERE status = 'PENDING' ORDER BY "createdAt" DESC LIMIT 5;
```

Sostituisci sotto: `BOOKING_ID`, `USER_ID`, `ROOM_ID`, `EXPECTED_CENTS` (es. 5000 = €50,00).

### a) `checkout.session.completed` (conferma + blocco slot)

Il trigger generico crea metadata finti → FK/business fail. Usa override:

```bash
stripe trigger checkout.session.completed \
  --override checkout_session:metadata.bookingId=BOOKING_ID \
  --override checkout_session:metadata.userId=USER_ID \
  --override checkout_session:metadata.paymentChoice=FULL \
  --override checkout_session:metadata.roomId=ROOM_ID \
  --override checkout_session:client_reference_id=BOOKING_ID \
  --override checkout_session:payment_status=paid \
  --override checkout_session:currency=eur \
  --override checkout_session:amount_total=EXPECTED_CENTS
```

**Verifica DB:** `Booking.status` = `PAID` (o `DEPOSIT_PAID`), riga `Payment` `SUCCEEDED`, riga in `stripe_webhook_event`.

> Nota: `stripe trigger` costruisce oggetti sintetici; se `payment_intent` manca o l’importo non matcha il tier, finirai in `PAYMENT_CONFLICT_REFUND_REQUIRED` (comportamento corretto). Per un happy-path affidabile: completa un Checkout reale con carta test `4242…` dalla UI.

Happy-path reale:

```bash
# 1. hold + checkout dalla UI
# 2. paga con 4242 4242 4242 4242
# 3. osserva l'evento in `stripe listen`
```

### b) `checkout.session.expired` (sblocco slot)

```bash
stripe trigger checkout.session.expired \
  --override checkout_session:metadata.bookingId=BOOKING_ID
```

**Verifica:** se era `PENDING` → `CANCELLED`, `holdExpiresAt` null. Se già `PAID`, resta `PAID` (guard).

### c) `payment_intent.payment_failed` (no-op)

```bash
stripe trigger payment_intent.payment_failed
```

**Verifica:** log `[stripe webhook] payment_intent.payment_failed (no-op...)`; booking `PENDING` **non** cancellato. Dopo 10 min hold o expiry sessione, lo slot si libera.

### d) `charge.refunded` (rimborso → CANCELLED)

1. Completa un pagamento reale (UI) così esiste `Payment.stripePaymentId = pi_...`
2. Dalla Dashboard test Stripe: Refund sul PaymentIntent, **oppure**:

```bash
stripe refunds create --payment-intent pi_XXX
# con `stripe listen` attivo arriverà charge.refunded
```

**Verifica:** `Payment.status` = `REFUNDED`; se non restano pagamenti `SUCCEEDED` → `Booking.status` = `CANCELLED` (slot libero).

Rimborso parziale:

```bash
stripe refunds create --payment-intent pi_XXX --amount 1000
```

**Verifica:** alert ops; booking **non** auto-cancellato.

### e) Duplicato stesso `event.id` (idempotenza)

1. Dopo un evento processato, leggi l’id:

```bash
# output di stripe listen, es. evt_1ABC...
```

2. Re-inoltra il payload firmato (es. dal log CLI) oppure:

```bash
stripe events resend evt_XXX
```

**Verifica:** risposta `200` con `{ received: true, duplicate: true }` (o equivalentemente received senza nuova riga `Payment`); una sola riga in `stripe_webhook_event` per quell’id.

---

## Fixture file

Template in `stripe/fixtures/checkout-completed.template.json`. Per fixtures CLI avanzate vedi [Stripe CLI fixtures](https://docs.stripe.com/cli/fixtures). Per Cage Room il percorso consigliato resta: **hold reale + Checkout test + listen**.
