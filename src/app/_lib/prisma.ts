import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionUrl = new URL(process.env.DATABASE_URL ?? '')
  // pg-connection-string emette un deprecation warning quando trova
  // sslmode=prefer|require|verify-ca nella stringa (verranno trattati come
  // alias di verify-full nella prossima major, con semantiche piu deboli).
  // Rimuoviamo il parametro dalla stringa PRIMA che venga fatto il parsing e
  // impostiamo l'equivalente esplicito verify-full via l'opzione `ssl` del
  // Pool, che verifica anche il certificato del server (piu sicuro di
  // `require`, che cifra ma non valida l'identita del server).
  const sslmode = connectionUrl.searchParams.get('sslmode')
  connectionUrl.searchParams.delete('sslmode')

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: sslmode && sslmode !== 'disable' ? { rejectUnauthorized: true } : undefined,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}