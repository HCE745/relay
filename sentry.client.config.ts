import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of transactions in dev/staging; lower this in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Record a session replay for 10% of sessions, 100% for sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask PII in replays
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Don't show Sentry errors in the browser console in development
  debug: false,

  // Filter out noisy browser errors that aren't actionable
  beforeSend(event) {
    // Drop chunk load errors (network/CDN issues outside our control)
    if (event.exception?.values?.some(v => v.value?.includes("ChunkLoadError"))) {
      return null
    }
    return event
  },
})
