import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { getOrgTimezone } from "./org"
import { Prisma } from "../../generated/prisma/client"
import {
  type Money,
  ZERO,
  dec,
  billableMinutes,
  entryLaborCost,
  isInBillingPeriod,
  startOfUtcDay,
  endOfUtcDay,
} from "../billing-math"
import { inclusiveDays } from "../indirect-costs"
import { prorate, variance, type BudgetPeriod, type Variance } from "../labor-budgets"

// Labor budgeting & variance (Phase 46). Budgets are planning figures; variance
// reuses the same APPROVED-time labor-cost definition profitability uses, but
// UNBURDENED (budgets are set on wages). Never payroll processing.

type BudgetInput = {
  scope: "CONTRACT" | "SITE" | "PLAN"
  contractId?: string | null
  serviceLocationId?: string | null
  servicePlanId?: string | null
  period: BudgetPeriod
  budgetedHours: string
  budgetedCost: string
  alertUnprofitable?: boolean
}

const targetInclude = {
  contract: { select: { title: true } },
  serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
  servicePlan: { select: { name: true, serviceLocation: { select: { name: true } } } },
} as const

function targetLabel(b: {
  scope: string
  contract: { title: string } | null
  serviceLocation: { name: string; customer: { name: string } } | null
  servicePlan: { name: string; serviceLocation: { name: string } } | null
}): { name: string; detail?: string } {
  if (b.scope === "CONTRACT") return { name: b.contract?.title ?? "(deleted contract)" }
  if (b.scope === "SITE") return { name: b.serviceLocation?.name ?? "(deleted site)", detail: b.serviceLocation?.customer.name }
  return { name: b.servicePlan?.name ?? "(deleted plan)", detail: b.servicePlan?.serviceLocation.name }
}

export async function listLaborBudgets(orgId: string) {
  const budgets = await orgDb(orgId).laborBudget.findMany({
    orderBy: [{ isActive: "desc" }, { scope: "asc" }, { createdAt: "asc" }],
    include: targetInclude,
  })
  return budgets.map((b) => ({
    id: b.id,
    scope: b.scope,
    ...targetLabel(b),
    contractId: b.contractId,
    serviceLocationId: b.serviceLocationId,
    servicePlanId: b.servicePlanId,
    period: b.period,
    budgetedHours: b.budgetedHours.toString(),
    budgetedCost: b.budgetedCost.toString(),
    alertUnprofitable: b.alertUnprofitable,
    isActive: b.isActive,
  }))
}

/** Targets to populate the create form (the three scopes the budget can attach to). */
export async function listBudgetTargets(orgId: string) {
  const db = orgDb(orgId)
  const [contracts, sites, plans] = await Promise.all([
    db.contract.findMany({ where: { status: { not: "CANCELLED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.serviceLocation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.servicePlan.findMany({ where: { isActive: true }, select: { id: true, name: true, serviceLocation: { select: { name: true } } }, orderBy: { name: "asc" } }),
  ])
  return {
    contracts,
    sites,
    plans: plans.map((p) => ({ id: p.id, name: `${p.name} — ${p.serviceLocation.name}` })),
  }
}

export async function createLaborBudget(orgId: string, input: BudgetInput) {
  return orgDb(orgId).laborBudget.create({
    data: {
      organizationId: orgId,
      scope: input.scope,
      contractId: input.scope === "CONTRACT" ? input.contractId ?? null : null,
      serviceLocationId: input.scope === "SITE" ? input.serviceLocationId ?? null : null,
      servicePlanId: input.scope === "PLAN" ? input.servicePlanId ?? null : null,
      period: input.period,
      budgetedHours: new Prisma.Decimal(input.budgetedHours),
      budgetedCost: new Prisma.Decimal(input.budgetedCost),
      alertUnprofitable: input.alertUnprofitable ?? true,
    },
  })
}

export async function updateLaborBudget(orgId: string, id: string, input: Partial<BudgetInput> & { isActive?: boolean }) {
  const data: Prisma.LaborBudgetUncheckedUpdateManyInput = {}
  if (input.period !== undefined) data.period = input.period
  if (input.budgetedHours !== undefined) data.budgetedHours = new Prisma.Decimal(input.budgetedHours)
  if (input.budgetedCost !== undefined) data.budgetedCost = new Prisma.Decimal(input.budgetedCost)
  if (input.alertUnprofitable !== undefined) data.alertUnprofitable = input.alertUnprofitable
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).laborBudget.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Labor budget")
  return orgDb(orgId).laborBudget.findFirst({ where: { id } })
}

// ─── Variance ────────────────────────────────────────────────────────────────

export type BudgetVarianceRow = {
  id: string
  scope: "CONTRACT" | "SITE" | "PLAN"
  name: string
  detail?: string
  period: BudgetPeriod
  hours: Variance
  cost: Variance
  scheduledHours: Money
  revenue: Money // invoiced revenue for the scope in range (0 when none)
  laborCostKnown: boolean // false if any salaried time is in scope (cost understated)
  overBudgetHours: boolean
  overBudgetCost: boolean
  unprofitable: boolean // alert on + revenue known + actual cost > revenue
}

const SCHEDULE_STATUSES = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] as const

function scopeWhere(b: { scope: string; contractId: string | null; serviceLocationId: string | null; servicePlanId: string | null }) {
  if (b.scope === "CONTRACT") return { servicePlan: { contractId: b.contractId ?? "__none__" } }
  if (b.scope === "SITE") return { serviceLocationId: b.serviceLocationId ?? "__none__" }
  return { servicePlanId: b.servicePlanId ?? "__none__" }
}

export async function getLaborBudgetVariance(
  orgId: string,
  input: { periodStart: string; periodEnd: string },
): Promise<BudgetVarianceRow[]> {
  const db = orgDb(orgId)
  const orgTz = await getOrgTimezone(orgId)
  const rangeDays = inclusiveDays(input.periodStart, input.periodEnd)
  const windowStart = new Date(startOfUtcDay(input.periodStart).getTime() - 86_400_000)
  const windowEnd = new Date(endOfUtcDay(input.periodEnd).getTime() + 86_400_000)

  const budgets = await db.laborBudget.findMany({ where: { isActive: true }, include: targetInclude })
  const rows: BudgetVarianceRow[] = []

  for (const b of budgets) {
    const jobs = await db.job.findMany({
      where: { status: { in: [...SCHEDULE_STATUSES] }, scheduledStart: { gte: windowStart, lte: windowEnd }, ...scopeWhere(b) },
      select: {
        scheduledStart: true,
        scheduledEnd: true,
        crewSize: true,
        serviceLocation: { select: { timezone: true } },
        servicePlan: { select: { crewSize: true, defaultDurationMin: true } },
        timeEntries: {
          where: { status: "APPROVED" },
          select: {
            clockInAt: true,
            clockOutAt: true,
            breakMinutes: true,
            approvedPayRate: true,
            approvedPayType: true,
            approvedDifferential: true,
            user: { select: { employeeProfile: { select: { payRate: true, payType: true } } } },
          },
        },
        invoiceLines: { where: { activeJobId: { not: null } }, select: { amount: true } },
      },
    })

    let scheduledHours = ZERO
    let actualHours = ZERO
    let actualCost = ZERO
    let revenue = ZERO
    let laborCostKnown = true

    for (const job of jobs) {
      const tz = job.serviceLocation.timezone ?? orgTz
      if (!isInBillingPeriod(job.scheduledStart, tz, input.periodStart, input.periodEnd)) continue

      const schedMin = job.scheduledEnd
        ? (job.scheduledEnd.getTime() - job.scheduledStart.getTime()) / 60_000
        : job.servicePlan?.defaultDurationMin ?? 0
      const crew = job.crewSize ?? job.servicePlan?.crewSize ?? 1
      if (schedMin > 0) scheduledHours = scheduledHours.plus(dec((crew * schedMin) / 60))

      for (const e of job.timeEntries) {
        actualHours = actualHours.plus(dec(billableMinutes(e) / 60))
        const rate = e.approvedPayRate ?? e.user.employeeProfile?.payRate ?? null
        const type = e.approvedPayType ?? e.user.employeeProfile?.payType ?? null
        const cost = entryLaborCost(e, rate, type)
        if (cost === null) laborCostKnown = false
        else actualCost = actualCost.plus(cost).plus(e.approvedDifferential ?? ZERO)
      }
      revenue = revenue.plus(job.invoiceLines.reduce((a, l) => a.plus(l.amount), ZERO))
    }

    const hours = variance(prorate(b.budgetedHours, b.period, rangeDays), actualHours.toDecimalPlaces(2))
    const cost = variance(prorate(b.budgetedCost, b.period, rangeDays), actualCost)
    const unprofitable = b.alertUnprofitable && revenue.greaterThan(ZERO) && actualCost.greaterThan(revenue)

    rows.push({
      id: b.id,
      scope: b.scope,
      ...targetLabel(b),
      period: b.period,
      hours,
      cost,
      scheduledHours: scheduledHours.toDecimalPlaces(2),
      revenue,
      laborCostKnown,
      overBudgetHours: hours.variance.greaterThan(ZERO),
      overBudgetCost: cost.variance.greaterThan(ZERO),
      unprofitable,
    })
  }

  return rows
}
