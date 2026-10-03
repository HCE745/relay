import { orgDb, systemDb } from "../org-db"
import { generateInvoice } from "./invoices"

// Recurring auto-invoicing (Phase 9). At period end a cron drafts invoices for
// every flat-period plan whose period has closed. DRAFT only — never auto-sent.
// Idempotent: generateInvoice claims each plan-period via activePeriodKey, so
// re-running (daily) bills a given period at most once.

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

export type PeriodInvoiceResult = { orgId: string; customers: number; created: number; error?: string }

export async function generatePeriodInvoicesForOrg(
  orgId: string,
  opts: { windowDays?: number; now?: Date } = {},
): Promise<PeriodInvoiceResult> {
  const now = opts.now ?? new Date()
  const windowDays = opts.windowDays ?? 100 // covers a just-ended month or quarter, with slack for back-fill
  const windowStart = isoDate(new Date(now.getTime() - windowDays * 86_400_000))
  const windowEnd = isoDate(now)

  // Customers with at least one active flat-period plan.
  const plans = await orgDb(orgId).servicePlan.findMany({
    where: { billingMode: "FLAT_PERIOD", isActive: true },
    select: { serviceLocation: { select: { customerId: true } } },
  })
  const customerIds = [...new Set(plans.map((p) => p.serviceLocation.customerId))]

  let created = 0
  for (const customerId of customerIds) {
    const r = await generateInvoice(
      orgId,
      { customerId, periodStart: windowStart, periodEnd: windowEnd },
      { flatOnly: true, endedOnly: true, now },
    )
    if (r.created) created++
  }
  return { orgId, customers: customerIds.length, created }
}

export async function generatePeriodInvoicesAllOrgs(opts: { windowDays?: number; now?: Date } = {}): Promise<PeriodInvoiceResult[]> {
  const orgs = await systemDb.organization.findMany({ select: { id: true } })
  const results: PeriodInvoiceResult[] = []
  for (const org of orgs) {
    try {
      results.push(await generatePeriodInvoicesForOrg(org.id, opts))
    } catch (e) {
      results.push({ orgId: org.id, customers: 0, created: 0, error: (e as Error).message })
    }
  }
  return results
}
