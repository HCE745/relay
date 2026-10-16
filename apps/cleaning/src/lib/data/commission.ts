import { orgDb, systemDb } from "../org-db"
import { assertFound, ReferenceError } from "./errors"
import { dec, ZERO, round2, type Money } from "../billing-math"
import { resolveCapabilities, parseOverrides, type PackageTier } from "../entitlements"
import { Prisma } from "../../generated/prisma/client"

// Commission & crew-based pay (Phase 37). Computes each worker's earnings for a
// completed job from the rule in effect, the job's billable amount, and the
// ACTUAL crew size. BOUNDARY: amounts for export only — no payroll processing,
// tax, or withholding. The pure core below is unit-tested; recompute wires it to
// the DB and is safe to re-run (completion, invoiced-later, void, crew change).

export type Basis = "HOURLY" | "FLAT_PER_JOB" | "PERCENT_OF_JOB_REVENUE"
export type Split = "PER_PERSON" | "SPLIT_ACROSS_CREW"
export type Band = "solo" | "pair" | "crew"

export function crewBand(crewSize: number): Band {
  return crewSize <= 1 ? "solo" : crewSize === 2 ? "pair" : "crew"
}

/** The band value in effect, falling back pair/crew → solo when not set. */
export function bandValue(rule: { soloValue: Money | null; pairValue: Money | null; crewValue: Money | null }, crewSize: number): Money | null {
  const band = crewBand(crewSize)
  const pick = band === "solo" ? rule.soloValue : band === "pair" ? rule.pairValue : rule.crewValue
  return pick ?? rule.soloValue ?? null
}

export type EarningResult = {
  amount: Money
  percentApplied: Money | null
  flatApplied: Money | null
  status: "CALCULATED" | "PENDING" | "VOIDED"
}

/**
 * Pure earning computation for one worker. `billable` is the job revenue (null
 * when not yet invoiced); `voidedRevenue` is true when the job HAD revenue that
 * was voided. Percentages are split across the crew or paid per person.
 */
export function computeEarning(input: {
  basis: Basis
  split: Split
  value: Money | null // band value: a percent (e.g. 40) or a flat amount
  billable: Money | null
  crewSize: number
  voidedRevenue?: boolean
}): EarningResult | null {
  const crew = Math.max(1, input.crewSize)
  if (input.basis === "HOURLY") return null // handled by the hourly/time system
  const value = input.value ?? ZERO

  if (input.basis === "FLAT_PER_JOB") {
    const base = round2(value)
    const amount = input.split === "SPLIT_ACROSS_CREW" ? round2(base.div(crew)) : base
    return { amount, percentApplied: null, flatApplied: base, status: "CALCULATED" }
  }

  // PERCENT_OF_JOB_REVENUE
  const pct = value
  if (input.billable == null || input.billable.lte(ZERO)) {
    return { amount: ZERO, percentApplied: pct, flatApplied: null, status: input.voidedRevenue ? "VOIDED" : "PENDING" }
  }
  const pool = round2(input.billable.times(pct).div(100))
  const amount = input.split === "SPLIT_ACROSS_CREW" ? round2(pool.div(crew)) : pool
  return { amount, percentApplied: pct, flatApplied: null, status: "CALCULATED" }
}

type RuleRow = {
  id: string; userId: string | null; role: string | null; basis: Basis; splitMode: Split
  soloValue: Money | null; pairValue: Money | null; crewValue: Money | null
  customerId: string | null; serviceLocationId: string | null; servicePlanId: string | null
  effectiveFrom: Date; isActive: boolean
}
type MatchCtx = { userId: string; role: string; customerId: string | null; serviceLocationId: string | null; servicePlanId: string | null; onDate: Date }

/** Most-specific, most-recent matching rule for a worker on a job (or null). */
export function resolvePayRule(rules: RuleRow[], ctx: MatchCtx): RuleRow | null {
  const candidates = rules.filter((r) => {
    if (!r.isActive || r.effectiveFrom > ctx.onDate) return false
    const scopeMatch = r.userId ? r.userId === ctx.userId : r.role ? r.role === ctx.role : false
    if (!scopeMatch) return false
    if (r.customerId && r.customerId !== ctx.customerId) return false
    if (r.serviceLocationId && r.serviceLocationId !== ctx.serviceLocationId) return false
    if (r.servicePlanId && r.servicePlanId !== ctx.servicePlanId) return false
    return true
  })
  if (candidates.length === 0) return null
  const score = (r: RuleRow) =>
    (r.userId ? 8 : 0) + (r.customerId ? 1 : 0) + (r.serviceLocationId ? 2 : 0) + (r.servicePlanId ? 1 : 0)
  return candidates.sort((a, b) => {
    const s = score(b) - score(a)
    if (s !== 0) return s
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
  })[0]!
}

async function orgHasCommissionPay(orgId: string): Promise<boolean> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { packageTier: true, capabilityOverrides: true } })
  if (!org) return false
  return resolveCapabilities({ packageTier: org.packageTier as PackageTier, capabilityOverrides: parseOverrides(org.capabilityOverrides) }).has("workforce.commissionPay")
}

/**
 * Recompute a job's commission/flat earnings from current state. Idempotent and
 * safe to call on any trigger. No-op unless the org has workforce.commissionPay.
 * Handles the stated edge cases: no billable amount (PENDING), invoiced later
 * (recompute fills it), voided invoice (VOIDED), crew added/removed (rows added
 * or deleted). HOURLY-basis workers are left to the existing time/labor system.
 */
export async function recomputeJobEarnings(orgId: string, jobId: string): Promise<{ computed: number }> {
  if (!(await orgHasCommissionPay(orgId))) return { computed: 0 }
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId },
    select: {
      id: true, status: true, scheduledStart: true, actualEnd: true, servicePlanId: true,
      serviceLocation: { select: { id: true, customerId: true } },
      assignments: { where: { status: "COMPLETED" }, select: { userId: true, user: { select: { role: true } } } },
      // Permanent jobId link (NOT activeJobId, which is nulled on void) so we can
      // still see revenue that was voided.
      invoiceLines: { where: { jobId, billable: true }, select: { amount: true, invoice: { select: { status: true } } } },
    },
  })
  if (!job) return { computed: 0 }

  // Only completed jobs carry earnings. If a job leaves COMPLETED, clear them.
  if (job.status !== "COMPLETED") {
    await db.jobEarning.deleteMany({ where: { jobId } })
    return { computed: 0 }
  }

  // Billable = non-voided revenue attributed to this job. Track whether revenue
  // existed but was voided, so we can mark VOIDED vs. never-invoiced (PENDING).
  let billable = ZERO
  let voidedRevenue = false
  for (const l of job.invoiceLines) {
    if (l.invoice?.status === "VOID") voidedRevenue = true
    else billable = billable.plus(l.amount)
  }
  const hasBillable = billable.gt(ZERO)

  const crew = job.assignments
  const crewSize = crew.length
  const onDate = job.actualEnd ?? job.scheduledStart

  const rules = (await db.payRule.findMany({ where: { isActive: true } })) as unknown as RuleRow[]

  const keptUserIds: string[] = []
  let computed = 0
  for (const member of crew) {
    const rule = resolvePayRule(rules, {
      userId: member.userId,
      role: member.user.role,
      customerId: job.serviceLocation?.customerId ?? null,
      serviceLocationId: job.serviceLocation?.id ?? null,
      servicePlanId: job.servicePlanId ?? null,
      onDate,
    })
    if (!rule || rule.basis === "HOURLY") continue // hourly handled by the time system
    const value = bandValue(rule, crewSize)
    const result = computeEarning({
      basis: rule.basis, split: rule.splitMode, value,
      billable: hasBillable ? billable : null, crewSize, voidedRevenue,
    })
    if (!result) continue
    keptUserIds.push(member.userId)
    const existing = await db.jobEarning.findFirst({ where: { jobId, userId: member.userId }, select: { id: true } })
    const data = {
      basis: rule.basis as Prisma.JobEarningCreateInput["basis"], splitMode: rule.splitMode as Prisma.JobEarningCreateInput["splitMode"],
      crewSize, percentApplied: result.percentApplied, flatApplied: result.flatApplied,
      billableAmount: billable, amount: result.amount, status: result.status as Prisma.JobEarningCreateInput["status"],
      ruleId: rule.id, computedAt: new Date(),
    }
    if (existing) await db.jobEarning.updateMany({ where: { id: existing.id }, data })
    else await db.jobEarning.create({ data: { organizationId: orgId, jobId, userId: member.userId, ...data } })
    computed++
  }
  // Crew removed after completion → drop their earnings.
  await db.jobEarning.deleteMany({ where: { jobId, userId: { notIn: keptUserIds.length ? keptUserIds : ["__none__"] } } })
  return { computed }
}

// ── Rule management ───────────────────────────────────────────────────────────

const ruleInclude = { user: { select: { id: true, name: true } } } as const

export function listPayRules(orgId: string) {
  return orgDb(orgId).payRule.findMany({ orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }], include: ruleInclude })
}

/** Dropdown options for the pay-rules form (employees + override targets). */
export async function payRuleOptions(orgId: string) {
  const db = orgDb(orgId)
  const [users, customers, sites, plans] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: { not: "CLIENT" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.customer.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.serviceLocation.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.servicePlan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  return { employees: users, customers, sites, plans }
}

export type PayRuleInput = {
  userId: string | null; role: string | null; basis: Basis; splitMode: Split
  soloValue: string | null; pairValue: string | null; crewValue: string | null
  customerId: string | null; serviceLocationId: string | null; servicePlanId: string | null
  effectiveFrom?: Date | null
}

function toDec(v: string | null): Prisma.Decimal | null { return v == null || v === "" ? null : dec(v) }

async function validateScope(orgId: string, input: PayRuleInput) {
  if (!input.userId && !input.role) throw new ReferenceError("A pay rule must target an employee or a role")
  if (input.userId && input.role) throw new ReferenceError("A pay rule targets an employee OR a role, not both")
  if (input.userId) {
    const u = await orgDb(orgId).user.findFirst({ where: { id: input.userId }, select: { id: true } })
    assertFound(u, "Employee")
  }
  if (input.basis !== "HOURLY" && input.soloValue == null) throw new ReferenceError("Set at least the solo rate")
}

export async function createPayRule(orgId: string, input: PayRuleInput) {
  await validateScope(orgId, input)
  const rule = await orgDb(orgId).payRule.create({
    data: {
      organizationId: orgId, userId: input.userId, role: input.role, basis: input.basis as Prisma.PayRuleCreateInput["basis"],
      splitMode: input.splitMode as Prisma.PayRuleCreateInput["splitMode"],
      soloValue: toDec(input.soloValue), pairValue: toDec(input.pairValue), crewValue: toDec(input.crewValue),
      customerId: input.customerId, serviceLocationId: input.serviceLocationId, servicePlanId: input.servicePlanId,
      ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
    },
    select: { id: true },
  })
  return rule
}

export async function updatePayRule(orgId: string, id: string, input: PayRuleInput) {
  const existing = await orgDb(orgId).payRule.findFirst({ where: { id }, select: { id: true } })
  assertFound(existing, "Pay rule")
  await validateScope(orgId, input)
  await orgDb(orgId).payRule.updateMany({
    where: { id },
    data: {
      userId: input.userId, role: input.role, basis: input.basis as Prisma.PayRuleCreateInput["basis"],
      splitMode: input.splitMode as Prisma.PayRuleCreateInput["splitMode"],
      soloValue: toDec(input.soloValue), pairValue: toDec(input.pairValue), crewValue: toDec(input.crewValue),
      customerId: input.customerId, serviceLocationId: input.serviceLocationId, servicePlanId: input.servicePlanId,
      ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
    },
  })
  return { id }
}

export async function deletePayRule(orgId: string, id: string) {
  const existing = await orgDb(orgId).payRule.findFirst({ where: { id }, select: { id: true } })
  assertFound(existing, "Pay rule")
  await orgDb(orgId).payRule.deleteMany({ where: { id } })
  return { id }
}

// ── Reads for the time screen, job detail, export, profitability ──────────────

/** Commission/flat earnings for a job (job-detail panel). */
export function listJobEarnings(orgId: string, jobId: string) {
  return orgDb(orgId).jobEarning.findMany({ where: { jobId }, include: { user: { select: { id: true, name: true } } }, orderBy: { amount: "desc" } })
}

/** A worker's earnings in a date window (time screen). */
export function listUserEarnings(orgId: string, userId: string, window: { start: Date; end: Date }) {
  return orgDb(orgId).jobEarning.findMany({
    where: { userId, job: { scheduledStart: { gte: window.start, lte: window.end } } },
    include: { job: { select: { id: true, title: true, scheduledStart: true } } },
    orderBy: { computedAt: "desc" },
  })
}

/** Per-worker earnings totals for a period (payroll export + time screen). */
export async function earningsByWorker(orgId: string, window: { start: Date; end: Date }) {
  const db = orgDb(orgId)
  const rows = await db.jobEarning.groupBy({
    by: ["userId"],
    where: { status: "CALCULATED", job: { scheduledStart: { gte: window.start, lte: window.end } } },
    _sum: { amount: true }, _count: true,
  })
  const names = rows.length
    ? new Map((await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    : new Map<string, string>()
  return rows.map((r) => ({ userId: r.userId, name: names.get(r.userId) ?? "—", total: r._sum.amount ?? ZERO, jobs: r._count }))
}

/** Total commission/flat labor cost for a single job (for profitability). */
export async function jobCommissionCost(orgId: string, jobId: string): Promise<Money> {
  const r = await orgDb(orgId).jobEarning.aggregate({ where: { jobId, status: "CALCULATED" }, _sum: { amount: true } })
  return r._sum.amount ?? ZERO
}
