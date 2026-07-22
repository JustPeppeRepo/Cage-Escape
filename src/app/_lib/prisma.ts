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

  // #region agent log
  pool.on('error', (err) => {
    fetch('http://127.0.0.1:7653/ingest/b95a8c87-326d-496a-8bbf-ad6c9410be8d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '4d555f',
      },
      body: JSON.stringify({
        sessionId: '4d555f',
        runId: 'pre-fix',
        hypothesisId: 'E',
        location: 'prisma.ts:pool.on(error)',
        message: 'pg pool error',
        data: { message: err.message, name: err.name },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  })
  fetch('http://127.0.0.1:7653/ingest/b95a8c87-326d-496a-8bbf-ad6c9410be8d', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '4d555f',
    },
    body: JSON.stringify({
      sessionId: '4d555f',
      runId: 'pre-fix',
      hypothesisId: 'E',
      location: 'prisma.ts:getOrCreatePool',
      message: 'Created pg pool',
      data: {
        host: connectionUrl.hostname,
        usesPooler: connectionUrl.hostname.includes('-pooler'),
        max: 10,
        connectionTimeoutMillis: 15_000,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

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
  globalForPrisma.prisma = client

  return client
}

export const prisma = getPrismaClient()
