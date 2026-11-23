import { systemDb } from "@/lib/org-db"
import { runCron } from "@/lib/cron-alert"
import { materializeDueInspections, runScheduledInspectionReminders } from "@/lib/scheduling/scheduled-inspections"
import { isSubscriptionEnforcementEnabled, backgroundOperationBlocked } from "@/lib/subscription/access"

// Scheduled-inspection cron (Phase 46): materializes due DRAFT inspections and
// sends lead-time reminders across all non-demo orgs. Idempotent (nextRunAt /
// reminderSentForRunAt guards). CRON_SECRET-gated via runCron.
export async function GET(request: Request) {
  return runCron("inspections", request, async () => {
    const orgs = await systemDb.organization.findMany({
      where: { isDemo: false },
      select: { id: true, isDemo: true, subscriptionStatus: true, trialEndsAt: true, stripeSubscriptionId: true, currentPeriodEnd: true },
    })
    const enforcementEnabled = isSubscriptionEnforcementEnabled()
    let created = 0, reminders = 0, failed = 0, skippedBilling = 0
    const failures: string[] = []
    for (const org of orgs) {
      if (backgroundOperationBlocked({ enforcementEnabled, org })) { skippedBilling++; continue }
      try {
        reminders += await runScheduledInspectionReminders(org.id)
        created += await materializeDueInspections(org.id)
      } catch (e) {
        failed++; failures.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return {
      failed,
      line: `orgs=${orgs.length} created=${created} reminders=${reminders} skippedBilling=${skippedBilling} failed=${failed}`,
      failures,
      body: { orgs: orgs.length, created, reminders, skippedBilling, failed },
    }
  })
}
