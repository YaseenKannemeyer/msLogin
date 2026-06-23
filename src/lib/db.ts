import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

const nodeProcess = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process

if (nodeProcess?.env?.NODE_ENV !== 'production') globalForPrisma.prisma = db
