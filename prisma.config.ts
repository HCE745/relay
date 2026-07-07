import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // DIRECT_URL bypasses Supabase's pgBouncer pooler for migrations,
  // which require persistent connections (prepared statements etc.)
  // Falls back to DATABASE_URL if DIRECT_URL is not set.
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
})
