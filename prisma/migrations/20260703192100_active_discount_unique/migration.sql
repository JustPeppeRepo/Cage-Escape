-- Un solo booking attivo (PENDING con hold, DEPOSIT_PAID o PAID) per codice sconto.
CREATE UNIQUE INDEX "Booking_active_discountCodeId_key"
ON "Booking" ("discountCodeId")
WHERE "discountCodeId" IS NOT NULL
  AND "status" IN ('PENDING', 'DEPOSIT_PAID', 'PAID');
