/**
 * Prisma-Client als Singleton.
 *
 * Die Verbindungsdaten kommen ausschließlich aus `DATABASE_URL` in der
 * Umgebung (CLAUDE.md, Regel 2); hier steht keine Verbindungszeichenfolge.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.APP_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
