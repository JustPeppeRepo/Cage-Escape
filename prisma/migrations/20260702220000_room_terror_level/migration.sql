-- Campo puramente presentazionale (1-5 teschi) per la card stanza in Home.
-- Additivo con default: non richiede backfill e non tocca vincoli esistenti.
ALTER TABLE "Room" ADD COLUMN "terrorLevel" INTEGER NOT NULL DEFAULT 3;
