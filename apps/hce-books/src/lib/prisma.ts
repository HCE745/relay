import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set")
  const adapter = new PrismaPg({ connectionString, max: parseInt(process.env.DATABASE_POOL_MAX ?? "3", 10) })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Lazy proxy — no connection is established at import time.
// The real PrismaClient is created on the first property access (first query),
// so Next.js can build without DATABASE_URL being present in the build environment.
export const prisma = new Proxy<PrismaClient>({} as PrismaClient, {
  get(_, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return Reflect.get(globalForPrisma.prisma, prop, globalForPrisma.prisma)
  },
})
