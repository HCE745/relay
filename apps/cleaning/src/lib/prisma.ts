import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL environment variable is not set")

  const adapter = new PrismaPg({
    connectionString,
    max: parseInt(process.env.DATABASE_POOL_MAX ?? "3", 10),
  })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Reuse across hot-reloads (dev) and warm serverless invocations (Vercel).
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma
