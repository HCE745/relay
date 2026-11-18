import { systemDb } from "@/lib/org-db"
import { runCron } from "@/lib/cron-alert"
import { runVisitReminders } from "@/lib/data/customer-comms"
import { runCollections } from "@/lib/data/collections"
import { isSubscriptionEnforcementEnabled, backgroundOperationBlocked } from "@/lib/subscription/access"

// Customer communications cron (Phase 26 + 44): pre-visit reminders + the
// multi-step collections sequence (or the legacy single reminder when no
// sequence is configured) across all orgs. Idempotent. CRON_SECRET-gated.
export async function GET(request: Request) {
  return runCron("customer-comms", request, async () => {
    const orgs = await systemDb.organization.findMany({
      where: { isDemo: false },
      select: { id: true, isDemo: true, subscriptionStatus: true, trialEndsAt: true, stripeSubscriptionId: true, currentPeriodEnd: true },
    })
    const enforcementEnabled = isSubscriptionEnforcementEnabled()
    let reminders = 0, payments = 0, failed = 0, skippedBilling = 0
    const failures: string[] = []
    for (const org of orgs) {
      // Customer-facing comms (visit reminders + collection notices) are paused
      // for a lapsed org when enforcement is on. These go to the ORG's customers,
      // never a CleanWare account-recovery message (those are separate and stay
      // unaffected). Fails closed.
      if (backgroundOperationBlocked({ enforcementEnabled, org })) { skippedBilling++; continue }
      try {
        reminders += await runVisitReminders(org.id)
        payments += (await runCollections(org.id)).sent
      } catch (e) {
        failed++; failures.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { failed, line: `orgs=${orgs.length} visitReminders=${reminders} collections=${payments} skippedBilling=${skippedBilling} failed=${failed}`, failures, body: { orgs: orgs.length, reminders, payments, skippedBilling, failed } }
  })
}
