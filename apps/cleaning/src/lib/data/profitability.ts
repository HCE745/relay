import { orgDb } from "../org-db"
import { getOrgTimezone } from "./org"
import { type Money, ZERO, laborCostForEntry, marginPct, isInBillingPeriod, startOfUtcDay, endOfUtcDay } from "../billing-math"

// ─── Site / customer / plan profitability (Phase 4) ──────────────────────────
//
// Revenue = actually-invoiced amount for a job (its non-VOID InvoiceLine).
// Labor cost = Σ APPROVED time × the pay rate SNAPSHOTTED at approval (falling
// back to the worker's current rate only for entries approved before snapshots
// existed). Money is Decimal throughout; period membership is by site-local day.
//
// This is pay-rate-derived — callers must gate it to OWNER/ADMIN/MANAGER.

type Row = { id: string; name: string; detail?: string; revenue: Money; laborCost: Money; jobs: number }
export type ProfitRow = {
  id: string
  name: string
  detail?: string
  revenue: Money
  laborCost: Money
  margin: Money
  marginPct: number | null
  jobs: number
}

function laborForEntry(e: {
  clockInAt: Date
  clockOutAt: Date | null
  breakMinutes: number
  approvedPayRate: Money | null
  approvedPayType: string | null
  user: { employeeProfile: { payRate: Money | null; payType: string | null } | null }
}): Money {
  const rate = e.approvedPayRate ?? e.user.employeeProfile?.payRate ?? null
  const type = e.approvedPayType ?? e.user.employeeProfile?.payType ?? null
  return laborCostForEntry(e, rate, type)
}

function upsert(map: Map<string, Row>, id: string, name: string, detail: string | undefined, billed: Money, labor: Money) {
  const row = map.get(id) ?? { id, name, detail, revenue: ZERO, laborCost: ZERO, jobs: 0 }
  row.revenue = row.revenue.plus(billed)
  row.laborCost = row.laborCost.plus(labor)
  row.jobs += 1
  map.set(id, row)
}

function finalize(map: Map<string, Row>): ProfitRow[] {
  return [...map.values()]
    .map((r) => ({ ...r, margin: r.revenue.minus(r.laborCost), marginPct: marginPct(r.revenue, r.laborCost) }))
    .sort((a, b) => Number(b.revenue.minus(a.revenue))) // biggest accounts first
}

export type Profitability = {
  bySite: ProfitRow[]
  byCustomer: ProfitRow[]
  byPlan: ProfitRow[]
  totals: { revenue: Money; laborCost: Money; margin: Money; marginPct: number | null; jobs: number }
}

export async function getProfitability(orgId: string, input: { periodStart: string; periodEnd: string }): Promise<Profitability> {
  const db = orgDb(orgId)
  const orgTz = await getOrgTimezone(orgId)
  const windowStart = new Date(startOfUtcDay(input.periodStart).getTime() - 86_400_000)
  const windowEnd = new Date(endOfUtcDay(input.periodEnd).getTime() + 86_400_000)

  const jobs = await db.job.findMany({
    where: { status: "COMPLETED", scheduledStart: { gte: windowStart, lte: windowEnd } },
    include: {
      serviceLocation: {
        select: { id: true, name: true, timezone: true, customer: { select: { id: true, name: true } } },
      },
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
    },
  })

  const bySite = new Map<string, Row>()
  const byCustomer = new Map<string, Row>()
  const byPlan = new Map<string, Row>()
  let totalRevenue = ZERO
  let totalLabor = ZERO
  let totalJobs = 0

  for (const job of jobs) {
    const siteTz = job.serviceLocation.timezone ?? orgTz
    if (!isInBillingPeriod(job.scheduledStart, siteTz, input.periodStart, input.periodEnd)) continue

    const billed = job.invoiceLines.reduce((a, l) => a.plus(l.amount), ZERO)
    const labor = job.timeEntries.reduce((a, e) => a.plus(laborForEntry(e)), ZERO)

    const site = job.serviceLocation
    const customer = site.customer
    upsert(bySite, site.id, site.name, customer.name, billed, labor)
    upsert(byCustomer, customer.id, customer.name, undefined, billed, labor)
    upsert(byPlan, job.servicePlan?.id ?? "__none__", job.servicePlan?.name ?? "One-off / no plan", undefined, billed, labor)

    totalRevenue = totalRevenue.plus(billed)
    totalLabor = totalLabor.plus(labor)
    totalJobs += 1
  }

  return {
    bySite: finalize(bySite),
    byCustomer: finalize(byCustomer),
    byPlan: finalize(byPlan),
    totals: {
      revenue: totalRevenue,
      laborCost: totalLabor,
      margin: totalRevenue.minus(totalLabor),
      marginPct: marginPct(totalRevenue, totalLabor),
      jobs: totalJobs,
    },
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
    },
  })
  if (!job) return null
  const billedAmount = job.invoiceLines.reduce((a, l) => a.plus(l.amount), ZERO)
  const laborCost = job.timeEntries.reduce((a, e) => a.plus(laborForEntry(e)), ZERO)
  return {
    billedAmount,
    laborCost,
    grossMargin: billedAmount.minus(laborCost),
    marginPct: marginPct(billedAmount, laborCost),
    approvedEntries: job.timeEntries.length,
    invoiced: job.invoiceLines.length > 0,
  }
}
