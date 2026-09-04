import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI (db push, generate, etc.) always connects via the direct
  // session-mode URL — PgBouncer transaction mode (DATABASE_URL port 6543)
  // stalls on DDL. The runtime app reads DATABASE_URL independently via
  // src/lib/prisma.ts using the PrismaPg adapter.
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
})
