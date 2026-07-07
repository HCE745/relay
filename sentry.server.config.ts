import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  integrations: [
    Sentry.consoleIntegration({ levels: ["error", "warn"] }),
    Sentry.onUnhandledRejectionIntegration({ mode: "warn" }),
  ],

  debug: false,

  beforeSend(event, hint) {
    const error = hint.originalException

    // Tag Prisma/database errors for easy filtering in Sentry dashboard
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (
        msg.includes("prisma") ||
        msg.includes("database") ||
        msg.includes("unique constraint") ||
        msg.includes("foreign key constraint") ||
        msg.includes("connection") ||
        (error.constructor.name ?? "").toLowerCase().includes("prisma")
      ) {
        event.tags = { ...event.tags, error_type: "database" }
      }

      // Tag AI/Anthropic errors
      if (msg.includes("anthropic") || msg.includes("api key")) {
        event.tags = { ...event.tags, error_type: "ai_api" }
      }
    }

    return event
  },
})
