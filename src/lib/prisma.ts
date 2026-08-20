// =====================================================================================
// SECURE PRISMA CLIENT - GLOBAL CACHED INSTANCE  
// Senior Full-Stack Security Engineer Implementation
// =====================================================================================

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// ⚠️ CRITICAL SECURITY CHECK [ENV_LEAK]: Confirming no secret keys are exposed
// This Prisma client utility uses DATABASE_URL which should contain connection
// credentials but is accessed only on the server-side. No browser exposure risk.

/**
 * Environment variable validation for database connection
 * Ensures DATABASE_URL is available for Prisma client initialization
 */
const getDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      "SECURITY ERROR: DATABASE_URL is required for Prisma client initialization"
    );
  }
  
  return databaseUrl;
};

// Increments after `prisma generate` when HMR might reuse a client with
// outdated DMMF/models (new fields or tables). Forces client recreation.
const PRISMA_CLIENT_REVISION = 4;

/**
 * Global cache interface for Prisma client and connection pool
 * Prevents multiple client instances during development hot reloads
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaRevision: number | undefined
  pgPool: Pool | undefined
}

/**
 * Creates or retrieves a cached PostgreSQL connection pool
 * Optimizes database connections with proper SSL and timeout configuration
 */
function getOrCreatePool(): Pool {
  if (globalForPrisma.pgPool) {
    return globalForPrisma.pgPool;
  }

  const databaseUrl = getDatabaseUrl();
  const connectionUrl = new URL(databaseUrl);
  const sslmode = connectionUrl.searchParams.get('sslmode');
  connectionUrl.searchParams.delete('sslmode');

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: sslmode && sslmode !== 'disable' ? { rejectUnauthorized: true } : undefined,
    max: 10,                        // Maximum pool size
    connectionTimeoutMillis: 15_000, // 15 second connection timeout  
    idleTimeoutMillis: 30_000,      // 30 second idle timeout
  });

  globalForPrisma.pgPool = pool;
  return pool;
}

/**
 * Creates a new Prisma client instance with PostgreSQL adapter
 * Uses connection pooling for optimal performance
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getOrCreatePool());
  
  return new PrismaClient({ 
    adapter,
    // Use custom output path if defined in schema
    // Falls back to default @prisma/client location
  });
}

/**
 * Retrieves or creates a globally cached Prisma client instance
 * 
 * PERFORMANCE FEATURES:
 * - Global caching prevents multiple client instances
 * - Revision-based cache invalidation for development
 * - PostgreSQL connection pooling for scalability
 * - Automatic SSL configuration from connection string
 * 
 * SECURITY FEATURES:
 * - Server-side only access (no browser exposure)
 * - Proper connection timeout and SSL handling
 * - Environment variable validation
 * 
 * @returns PrismaClient instance with connection pooling
 */
function getPrismaClient(): PrismaClient {
  // Return cached client if available and up-to-date
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaRevision === PRISMA_CLIENT_REVISION
  ) {
    return globalForPrisma.prisma;
  }

  // Create new client and cache it globally
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;

  return client;
}

/**
 * Globally cached Prisma client instance
 * Use this export for all database operations throughout the application
 */
export const prisma = getPrismaClient();

// Re-export Prisma types for convenience
export { Prisma, type PrismaClient } from '@prisma/client';