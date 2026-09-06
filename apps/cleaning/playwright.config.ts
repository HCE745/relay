import { defineConfig } from "@playwright/test"

// Phase 1 E2E. Requires a running app pointed at a seeded database. In CI, set
// DATABASE_URL/DIRECT_URL/CLEANING_SESSION_SECRET, run migrate + seed, then
// `next build`; Playwright starts the server via the webServer block below.
const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start --port ${PORT}`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
