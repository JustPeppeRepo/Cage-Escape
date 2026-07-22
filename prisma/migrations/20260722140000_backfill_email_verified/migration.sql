-- Account creati prima dell'enforcement di requireEmailVerification avevano
-- emailVerified=false di default. Senza questo backfill, abilitare la verifica
-- obbligatoria bloccherebbe login (e admin) per tutti gli utenti esistenti.
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
