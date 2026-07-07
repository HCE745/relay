import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL environment variable is not set")

  // Limit pool size to avoid exhausting Supabase's connection limit on the
  // free/starter plan (15–60 direct connections). Use port 6543 (pgBouncer)
  // in DATABASE_URL on Vercel for higher concurrency.
  const adapter = new PrismaPg({
    connectionString,
    max: parseInt(process.env.DATABASE_POOL_MAX ?? "3", 10),
  })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Cache across hot-reloads in dev AND across warm invocations in production
// (Vercel reuses serverless function instances).
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma
