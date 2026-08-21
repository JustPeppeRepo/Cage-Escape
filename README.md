# Cage Escape Room (`cageroom_3.0`)

Sito prenotazioni escape room: **Next.js 16**, **Prisma 7**, **Supabase Auth**, **Stripe**, **PostgreSQL**.

Documentazione viva:

- [`ROADMAP.md`](./ROADMAP.md) — stato, backlog, checklist pre-deploy
- [`.env.example`](./.env.example) — variabili d'ambiente e **dove prenderle**
- [`SECURITY_AUDIT_MIGRATION.md`](./SECURITY_AUDIT_MIGRATION.md) — audit auth / RLS / pagamenti / cron
- [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — rotte e file

## Avvio locale

```bash
cp .env.example .env   # poi compila i valori (vedi commenti nel file)
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

In produzione Vercel imposta le stesse variabili in **Project → Settings → Environment Variables**. `VERCEL_ENV` è iniettata automaticamente.

## Deploy

Piattaforma prevista: [Vercel](https://vercel.com). Cron keep-alive: `vercel.json` → `/api/cron/keep-alive` (richiede `CRON_SECRET`).
