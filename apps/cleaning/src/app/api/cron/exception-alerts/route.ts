import { systemDb } from "@/lib/org-db"
import { runCron } from "@/lib/cron-alert"
import { runExceptionAlerts } from "@/lib/data/exceptions"

// Detects operational exceptions (uncovered shifts, missed clock-ins, expiring
// credentials) across all orgs and pushes alerts via the notification system.
// Idempotent per (event, entity). CRON_SECRET-gated; fails loud on error.
export async function GET(request: Request) {
  return runCron("exception-alerts", request, async () => {
    const orgs = await systemDb.organization.findMany({ where: { isDemo: false }, select: { id: true } })
    let uncovered = 0, missed = 0, credentials = 0, failed = 0
    const failures: string[] = []
    for (const org of orgs) {
      try {
        const r = await runExceptionAlerts(org.id)
        uncovered += r.uncovered; missed += r.missed; credentials += r.credentials
      } catch (e) {
        failed++; failures.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return {
      failed,
      line: `orgs=${orgs.length} uncovered=${uncovered} missed=${missed} credentials=${credentials} failed=${failed}`,
      failures,
      body: { orgs: orgs.length, uncovered, missed, credentials, failed },
    }
  })
}
