-- Tabella additiva per le fasce di prezzo per numero di partecipanti.
-- Nessuna modifica a colonne esistenti: Room.prezzoTotale/prezzoCaparra
-- restano invariati (prezzo indicativo di listing).
CREATE TABLE "RoomPricingTier" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "minParticipants" INTEGER NOT NULL,
  "maxParticipants" INTEGER NOT NULL,
  "totalPrice" DECIMAL(65,30) NOT NULL,
  "depositPrice" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "RoomPricingTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomPricingTier_roomId_minParticipants_maxParticipants_key"
  ON "RoomPricingTier"("roomId", "minParticipants", "maxParticipants");
CREATE INDEX "RoomPricingTier_roomId_idx" ON "RoomPricingTier"("roomId");

ALTER TABLE "RoomPricingTier" ADD CONSTRAINT "RoomPricingTier_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
