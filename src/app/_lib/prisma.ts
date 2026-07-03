import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
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
  const cached = globalForPrisma.prisma

  if (cached?.review) {
    return cached
  }

  const client = createPrismaClient()

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }

  return client
}

export const prisma = getPrismaClient()
