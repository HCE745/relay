// Relative (not "@/") so tsx scripts and Next both resolve it identically.
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL environment variable is not set")

  const adapter = new PrismaPg({
    connectionString,
    max: parseInt(process.env.DATABASE_POOL_MAX ?? "3", 10),
    // Serverless + Supabase pooler: a low-traffic function instance can hold an
    // idle pooled connection long enough for the server to close it, after which
    // the next query on that handed-out connection throws "Connection closed".
    // Close our idle connections first (well under the server's idle window) so a
    // fresh one is created on the next query, and keep TCP alive to avoid silent
    // drops. connectionTimeout bounds how long we wait for a new connection.
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
}

// Lazy proxy: the client is created on first property access, not at import.
// This keeps pure modules (e.g. org-db's scopeArgs) importable in unit tests
// without a DATABASE_URL, while callers still use `prisma.model.op(...)` as
// usual. Methods are bound to the real client so `this` stays correct.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
}) as PrismaClient
