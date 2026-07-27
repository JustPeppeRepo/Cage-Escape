import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Incrementa dopo `prisma generate` quando HMR potrebbe riusare un client
// globalThis con DMMF/modelli non aggiornati (campi o tabelle nuovi).
const PRISMA_CLIENT_REVISION = 3

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaRevision: number | undefined
  pgPool: Pool | undefined
}

function getOrCreatePool(): Pool {
  if (globalForPrisma.pgPool) {
    return globalForPrisma.pgPool
  }

  const connectionUrl = new URL(process.env.DATABASE_URL ?? '')
  const sslmode = connectionUrl.searchParams.get('sslmode')
  connectionUrl.searchParams.delete('sslmode')

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: sslmode && sslmode !== 'disable' ? { rejectUnauthorized: true } : undefined,
    max: 10,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  })

  globalForPrisma.pgPool = pool
  return pool
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getOrCreatePool())
  return new PrismaClient({ adapter })
}

function getPrismaClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaRevision === PRISMA_CLIENT_REVISION
  ) {
    return globalForPrisma.prisma
  }

  const client = createPrismaClient()
  globalForPrisma.prisma = client
  globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION

  return client
}

export const prisma = getPrismaClient()
