import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // DIRECT_URL uses a plain Postgres connection (no pgbouncer flags) — works for both
  // the Next.js server and the workers. Fall back to DATABASE_URL if not set.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = new pg.Pool({ connectionString }) as any
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
