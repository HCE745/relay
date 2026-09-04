import "server-only"
import * as Sentry from "@sentry/nextjs"

// Tag every server-side error in this request with the organization context so
// the Super Admin diagnostics tab can filter Sentry issues by org.
export function setOrgContext(orgId: string, orgName: string) {
  Sentry.getCurrentScope().setTags({
    organization_id: orgId,
    organization_name: orgName,
  })
}

export function captureDbError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags:  { error_type: "database" },
    extra: context,
  })
}

// Use in API routes to wrap a handler and automatically report any thrown error
export async function withSentryApiRoute<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    Sentry.captureException(error, { extra: context })
    throw error
  }
}

export { Sentry }
