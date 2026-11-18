import { systemDb } from "@/lib/org-db"
import { runCron } from "@/lib/cron-alert"
import { runExceptionAlerts } from "@/lib/data/exceptions"
import { runIssueEscalation } from "@/lib/data/issue-escalation"
import { isSubscriptionEnforcementEnabled, backgroundOperationBlocked } from "@/lib/subscription/access"

// Detects operational exceptions (uncovered shifts, missed clock-ins, expiring
// credentials) across all orgs and pushes alerts via the notification system.
// Idempotent per (event, entity). CRON_SECRET-gated; fails loud on error.
export async function GET(request: Request) {
  return runCron("exception-alerts", request, async () => {
    const orgs = await systemDb.organization.findMany({
      where: { isDemo: false },
      select: { id: true, isDemo: true, subscriptionStatus: true, trialEndsAt: true, stripeSubscriptionId: true, currentPeriodEnd: true },
    })
    const enforcementEnabled = isSubscriptionEnforcementEnabled()
    let uncovered = 0, missed = 0, credentials = 0, escalated = 0, failed = 0, skippedBilling = 0
    const failures: string[] = []
    for (const org of orgs) {
      // A lapsed org's exception processing is paused when enforcement is on, so
      // it creates no new operational activity (issue escalation bumps, alert
      // notifications). Existing records are untouched. Fails closed.
      if (backgroundOperationBlocked({ enforcementEnabled, org })) { skippedBilling++; continue }
      try {
        const r = await runExceptionAlerts(org.id)
        uncovered += r.uncovered; missed += r.missed; credentials += r.credentials
        const ie = await runIssueEscalation(org.id)
        escalated += ie.escalated + ie.overdue + ie.unassigned
      } catch (e) {
        failed++; failures.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return {
      failed,
      line: `orgs=${orgs.length} uncovered=${uncovered} missed=${missed} credentials=${credentials} issueAlerts=${escalated} skippedBilling=${skippedBilling} failed=${failed}`,
      failures,
      body: { orgs: orgs.length, uncovered, missed, credentials, issueAlerts: escalated, skippedBilling, failed },
    }
  })
}
