import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Claude.ai expects OAuth discovery at this dotted URL; Next.js can't route dots, so rewrite it
        source:      "/api/mcp/.well-known/oauth-authorization-server",
        destination: "/api/mcp/oauth-metadata",
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry org/project from dashboard — needed for source map uploads
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads (Settings → Auth Tokens in Sentry)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry build output unless running in CI
  silent: !process.env.CI,

  // Upload wider set of source maps for better stack traces
  widenClientFileUpload: true,

  // Route Sentry telemetry through our own server to bypass ad-blockers
  tunnelRoute: "/monitoring-tunnel",

  // Delete source maps from the build output after uploading to Sentry
  // so they aren't served publicly
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tree-shake Sentry logger to reduce bundle size
  disableLogger: true,

  // Wire up Vercel Cron Monitor for cron job health tracking
  automaticVercelMonitors: true,
})
