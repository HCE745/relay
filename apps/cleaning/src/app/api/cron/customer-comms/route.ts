import { systemDb } from "@/lib/org-db"
import { runCron } from "@/lib/cron-alert"
import { runVisitReminders, runPaymentReminders } from "@/lib/data/customer-comms"

// Customer communications cron (Phase 26): pre-visit reminders + late-payment
// reminders across all orgs. Idempotent per job/invoice. CRON_SECRET-gated.
export async function GET(request: Request) {
  return runCron("customer-comms", request, async () => {
    const orgs = await systemDb.organization.findMany({ where: { isDemo: false }, select: { id: true } })
    let reminders = 0, payments = 0, failed = 0
    const failures: string[] = []
    for (const org of orgs) {
      try {
        reminders += await runVisitReminders(org.id)
        payments += await runPaymentReminders(org.id)
      } catch (e) {
        failed++; failures.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { failed, line: `orgs=${orgs.length} visitReminders=${reminders} paymentReminders=${payments} failed=${failed}`, failures, body: { orgs: orgs.length, reminders, payments, failed } }
  })
}
