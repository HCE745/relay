import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI (migrate, generate, …) connects via the direct session-mode URL.
  // Supabase's PgBouncer transaction pooler (DATABASE_URL, port 6543) stalls on
  // DDL. The runtime app reads DATABASE_URL separately in src/lib/prisma.ts.
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
})
