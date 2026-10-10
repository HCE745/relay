import { generatePeriodInvoicesAllOrgs } from "@/lib/data/period-invoicing"
import { runCron } from "@/lib/cron-alert"

// Recurring flat-period auto-invoicing (Phase 9). CRON_SECRET-gated; idempotent
// (activePeriodKey unique). Produces DRAFT invoices only. Fails loud on error.
export async function GET(request: Request) {
  return runCron("period-invoices", request, async () => {
    const results = await generatePeriodInvoicesAllOrgs()
    const created = results.reduce((s, r) => s + r.created, 0)
    const failed = results.filter((r) => r.error).length
    return {
      failed,
      line: `orgs=${results.length} created=${created} failed=${failed}`,
      failures: results.filter((r) => r.error).map((r) => `${r.orgId}: ${r.error}`),
      body: { orgs: results.length, created, failed, results },
    }
  })
}
