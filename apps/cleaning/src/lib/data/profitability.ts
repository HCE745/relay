import { orgDb } from "../org-db"
import { getOrgTimezone } from "./org"
import {
  type Money,
  type JobMarginInput,
  type MarginSummary,
  ZERO,
  entryLaborCost,
  marginPct,
  summarizeMargin,
  countsTowardMargin,
  isInBillingPeriod,
  startOfUtcDay,
  endOfUtcDay,
} from "../billing-math"

// ─── Site / customer / plan profitability (Phase 4) ──────────────────────────
//
// Revenue = actually-invoiced amount for a job (its non-VOID InvoiceLine).
// Labor cost = Σ APPROVED HOURLY time × the pay rate SNAPSHOTTED at approval
// (falling back to the worker's current rate only for entries approved before
// snapshots existed). SALARY time is EXCLUDED — never invented (see
// entryLaborCost); a job with any such entry is "labor unavailable" and left
// out of margin. Uninvoiced completed jobs are excluded by default so unbilled
// work is never a false loss — pass includeUninvoiced to fold them in.
//
// Pay-rate-derived — callers must gate to OWNER/ADMIN/MANAGER.

type ApprovedEntry = {
  clockInAt: Date
  clockOutAt: Date | null
  breakMinutes: number
  approvedPayRate: Money | null
  approvedPayType: string | null
  user: { employeeProfile: { payRate: Money | null; payType: string | null } | null }
}

/** Job labor: total known (hourly) cost, whether it is fully known, and whether any salaried time is present. */
function jobLabor(entries: ApprovedEntry[]): { known: boolean; labor: Money; salaried: boolean } {
  let labor = ZERO
  let known = true
  let salaried = false
  for (const e of entries) {
    const type = e.approvedPayType ?? e.user.employeeProfile?.payType ?? null
    const rate = e.approvedPayRate ?? e.user.employeeProfile?.payRate ?? null
    if (type === "SALARY") salaried = true
    const cost = entryLaborCost(e, rate, type)
    if (cost === null) known = false
    else labor = labor.plus(cost)
  }
  return { known, labor, salaried }
}

type Row = { id: string; name: string; detail?: string; revenue: Money; laborCost: Money; suppliesCost: Money; jobs: number }
export type ProfitRow = {
  id: string
  name: string
  detail?: string
  revenue: Money
  laborCost: Money
  suppliesCost: Money
  margin: Money
  marginPct: number | null
  jobs: number
}

function upsert(map: Map<string, Row>, id: string, name: string, detail: string | undefined, billed: Money, labor: Money, supplies: Money) {
  const row = map.get(id) ?? { id, name, detail, revenue: ZERO, laborCost: ZERO, suppliesCost: ZERO, jobs: 0 }
  row.revenue = row.revenue.plus(billed)
  row.laborCost = row.laborCost.plus(labor)
  row.suppliesCost = row.suppliesCost.plus(supplies)
  row.jobs += 1
  map.set(id, row)
}

function finalize(map: Map<string, Row>): ProfitRow[] {
  return [...map.values()]
    .map((r) => {
      const cost = r.laborCost.plus(r.suppliesCost)
      return { ...r, margin: r.revenue.minus(cost), marginPct: marginPct(r.revenue, cost) }
    })
    .sort((a, b) => Number(b.revenue.minus(a.revenue))) // biggest accounts first
}

/** Sum a job's allocated supply cost from snapshotted usage (Phase 12). */
function jobSupplies(usages: { quantity: Money; costPerUnit: Money | null }[]): Money {
  return usages.reduce((a, u) => (u.costPerUnit ? a.plus(u.quantity.times(u.costPerUnit)) : a), ZERO)
}

export type Profitability = {
  bySite: ProfitRow[]
  byCustomer: ProfitRow[]
  byPlan: ProfitRow[]
  summary: MarginSummary
  includeUninvoiced: boolean
}

export async function getProfitability(
  orgId: string,
  input: { periodStart: string; periodEnd: string; includeUninvoiced?: boolean },
): Promise<Profitability> {
  const includeUninvoiced = input.includeUninvoiced ?? false
  const db = orgDb(orgId)
  const orgTz = await getOrgTimezone(orgId)
  const windowStart = new Date(startOfUtcDay(input.periodStart).getTime() - 86_400_000)
  const windowEnd = new Date(endOfUtcDay(input.periodEnd).getTime() + 86_400_000)

  const jobs = await db.job.findMany({
    where: { status: "COMPLETED", scheduledStart: { gte: windowStart, lte: windowEnd } },
    include: {
      serviceLocation: { select: { id: true, name: true, timezone: true, customer: { select: { id: true, name: true } } } },
      servicePlan: { select: { id: true, name: true } },
      timeEntries: {
        where: { status: "APPROVED" },
        select: {
          clockInAt: true,
          clockOutAt: true,
          breakMinutes: true,
          approvedPayRate: true,
          approvedPayType: true,
          user: { select: { employeeProfile: { select: { payRate: true, payType: true } } } },
        },
      },
      invoiceLines: { where: { activeJobId: { not: null } }, select: { amount: true } },
      supplyUsages: { select: { quantity: true, costPerUnit: true } },
    },
  })

  const bySite = new Map<string, Row>()
  const byCustomer = new Map<string, Row>()
  const byPlan = new Map<string, Row>()
  const summaryInputs: JobMarginInput[] = []

  for (const job of jobs) {
    const siteTz = job.serviceLocation.timezone ?? orgTz
    if (!isInBillingPeriod(job.scheduledStart, siteTz, input.periodStart, input.periodEnd)) continue

    const billed = job.invoiceLines.reduce((a, l) => a.plus(l.amount), ZERO)
    const invoiced = job.invoiceLines.length > 0
    const { known, labor } = jobLabor(job.timeEntries)
    const supplies = jobSupplies(job.supplyUsages)

    summaryInputs.push({ invoiced, laborKnown: known, billed, labor, supplies })

    // Rows include only jobs that count toward margin, so row sums match totals.
    if (countsTowardMargin({ invoiced, laborKnown: known }, includeUninvoiced)) {
      const site = job.serviceLocation
      upsert(bySite, site.id, site.name, site.customer.name, billed, labor, supplies)
      upsert(byCustomer, site.customer.id, site.customer.name, undefined, billed, labor, supplies)
      upsert(byPlan, job.servicePlan?.id ?? "__none__", job.servicePlan?.name ?? "One-off / no plan", undefined, billed, labor, supplies)
    }
  }

  return {
    bySite: finalize(bySite),
    byCustomer: finalize(byCustomer),
    byPlan: finalize(byPlan),
    summary: summarizeMargin(summaryInputs, includeUninvoiced),
    includeUninvoiced,
  }
}

/** Per-job profitability for the (manager-only) panel on job detail. */
export async function getJobProfitability(orgId: string, jobId: string) {
  const job = await orgDb(orgId).job.findFirst({
    where: { id: jobId },
    select: {
      timeEntries: {
        where: { status: "APPROVED" },
        select: {
          clockInAt: true,
          clockOutAt: true,
          breakMinutes: true,
          approvedPayRate: true,
          approvedPayType: true,
          user: { select: { employeeProfile: { select: { payRate: true, payType: true } } } },
        },
      },
      invoiceLines: { where: { activeJobId: { not: null } }, select: { amount: true } },
      supplyUsages: { select: { quantity: true, costPerUnit: true } },
    },
  })
  if (!job) return null

  const billedAmount = job.invoiceLines.reduce((a, l) => a.plus(l.amount), ZERO)
  const invoiced = job.invoiceLines.length > 0
  const { known, labor, salaried } = jobLabor(job.timeEntries)
  const supplies = jobSupplies(job.supplyUsages)
  const totalCost = labor.plus(supplies)

  return {
    billedAmount,
    invoiced,
    laborAvailable: known,
    salaried,
    laborCost: known ? labor : null,
    suppliesCost: supplies,
    // Margin only when we have both real revenue and a known labor cost.
    grossMargin: known && invoiced ? billedAmount.minus(totalCost) : null,
    marginPct: known && invoiced ? marginPct(billedAmount, totalCost) : null,
    approvedEntries: job.timeEntries.length,
  }
}

/**
 * Supply spend by site (Phase 12): total allocated supply cost per site in a
 * period, from snapshotted usage. Independent of invoicing — shows where
 * consumables actually go. Rides reporting.profitability.
 */
export async function getSupplySpendBySite(orgId: string, input: { periodStart: string; periodEnd: string }) {
  const db = orgDb(orgId)
  const start = startOfUtcDay(input.periodStart)
  const end = endOfUtcDay(input.periodEnd)
  // Spend is dated by the job's service date when the usage is tied to a job,
  // else by when it was recorded — matching how profitability dates work.
  const usages = await db.supplyUsage.findMany({
    where: {
      costPerUnit: { not: null },
      OR: [{ job: { scheduledStart: { gte: start, lte: end } } }, { jobId: null, createdAt: { gte: start, lte: end } }],
    },
    select: {
      quantity: true,
      costPerUnit: true,
      job: { select: { serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } } } },
      serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } },
    },
  })
  const map = new Map<string, { id: string; name: string; detail?: string; cost: Money; items: number }>()
  let total = ZERO
  for (const u of usages) {
    const line = u.costPerUnit ? u.quantity.times(u.costPerUnit) : ZERO
    total = total.plus(line)
    const site = u.job?.serviceLocation ?? u.serviceLocation
    const id = site?.id ?? "__none__"
    const row = map.get(id) ?? { id, name: site?.name ?? "No site", detail: site?.customer?.name, cost: ZERO, items: 0 }
    row.cost = row.cost.plus(line)
    row.items += 1
    map.set(id, row)
  }
  const rows = [...map.values()].sort((a, b) => Number(b.cost.minus(a.cost)))
  return { rows, total }
}
