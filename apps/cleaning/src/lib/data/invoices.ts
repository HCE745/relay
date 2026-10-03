import { orgDb, isUniqueViolation } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { getOrgTimezone } from "./org"
import { Prisma } from "../../generated/prisma/client"
import {
  type Money,
  type InvoiceStatusValue,
  ZERO,
  round2,
  billableMinutes,
  flatLine,
  hourlyLine,
  dueDateFromTerms,
  agingBucket,
  startOfUtcDay,
  endOfUtcDay,
  isInBillingPeriod,
  deriveInvoiceStatus,
  remainingBalance,
  overpays,
  OUTSTANDING_STATUSES,
} from "../billing-math"
import { periodsInWindow } from "../billing-periods"

// ─── Billing / invoicing (Phase 2) ───────────────────────────────────────────
//
// Money is Prisma.Decimal end-to-end — never a JS float. Amounts are rounded to
// 2 dp at the LINE level; the invoice subtotal is the exact sum of rounded
// lines. Tax is always 0 for now. Pure math lives in ../billing-math (tested).
//
// Idempotency mirrors job generation: a job may sit on at most one non-VOID
// invoice, enforced by a DB unique index on InvoiceLine.activeJobId. Generation
// pre-filters already-invoiced jobs and, on a P2002 race, drops the contested
// job and retries — it never double-bills.

export type InvoiceExclusion = { jobId: string; title: string; reason: string }
export type GenerateInvoiceResult =
  | { created: true; invoiceId: string; invoiceNumber: number; lineCount: number; total: string; excluded: InvoiceExclusion[] }
  | { created: false; reason: string; excluded: InvoiceExclusion[] }

// A single prospective invoice line. `billable` lines sum to the total; the
// non-billable "covered service" detail lines under a flat charge are amount 0.
// Exactly one of activeJobId / activePeriodKey claims the thing being billed so
// it can never be billed twice on a non-VOID invoice.
type LineDraft = {
  jobId: string | null
  activeJobId: string | null
  activePeriodKey: string | null
  billable: boolean
  description: string
  siteName: string
  serviceDate: Date
  quantity: Money
  unitRate: Money
  amount: Money
}

/**
 * Generate a DRAFT invoice for a customer over a period.
 *
 * PER_JOB plans bill each completed visit (flat or hourly) as today. FLAT_PERIOD
 * plans bill one flat charge per billing period they overlap, and list the
 * visits they covered as non-billable detail — those visits are claimed so they
 * can't also be billed per-job. Never auto-sends (status DRAFT).
 *
 * `opts.flatOnly` (cron) skips per-job billing entirely; `opts.endedOnly` only
 * bills periods that have fully ended as of `opts.now`.
 */
export async function generateInvoice(
  orgId: string,
  input: { customerId: string; periodStart: string; periodEnd: string },
  opts: { flatOnly?: boolean; endedOnly?: boolean; now?: Date } = {},
): Promise<GenerateInvoiceResult> {
  const db = orgDb(orgId)
  const customer = await db.customer.findFirst({
    where: { id: input.customerId },
    select: { id: true, paymentTerms: true },
  })
  assertFound(customer, "Customer")

  const now = opts.now ?? new Date()
  const periodStart = startOfUtcDay(input.periodStart)
  const periodEnd = endOfUtcDay(input.periodEnd)

  // Period membership is decided by the site's LOCAL wall-clock day, the same
  // timezone resolution the scheduler uses (site override, else org default). We
  // fetch a widened UTC window — ±1 day covers every real offset — and let
  // isInBillingPeriod() make the exact call.
  const orgTz = await getOrgTimezone(orgId)
  const windowStart = new Date(periodStart.getTime() - 86_400_000)
  const windowEnd = new Date(periodEnd.getTime() + 86_400_000)

  const jobs = await db.job.findMany({
    where: {
      status: "COMPLETED",
      scheduledStart: { gte: windowStart, lte: windowEnd },
      serviceLocation: { customerId: input.customerId },
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      serviceLocation: { select: { name: true, timezone: true } },
      servicePlan: { select: { id: true, name: true, billingMode: true, billingType: true, rate: true, currency: true } },
      timeEntries: { select: { status: true, clockInAt: true, clockOutAt: true, breakMinutes: true } },
      // Non-empty only when this job already sits on a non-VOID invoice.
      invoiceLines: { where: { activeJobId: { not: null } }, select: { id: true } },
    },
  })

  // Active flat-period plans for this customer — billed even with zero visits.
  const flatPlans = await db.servicePlan.findMany({
    where: { billingMode: "FLAT_PERIOD", isActive: true, serviceLocation: { customerId: input.customerId } },
    select: {
      id: true,
      name: true,
      periodAmount: true,
      periodFrequency: true,
      currency: true,
      serviceLocation: { select: { name: true, timezone: true } },
    },
  })

  const excluded: InvoiceExclusion[] = []
  const drafts: LineDraft[] = []
  // The first billable line sets the invoice currency; anything in another
  // currency can't be summed onto it and is excluded. One invoice, one currency.
  let currency: string | null = null

  // Visits covered by a flat plan — collected for detail lines regardless of
  // flatOnly, and kept out of per-job billing.
  type CoveredJob = { id: string; title: string; siteName: string; serviceDate: Date; scheduledStart: Date; siteTz: string; claimed: boolean }
  const coveredByPlan = new Map<string, CoveredJob[]>()

  // ── Per-visit lines (and flat-plan visit collection) ──
  for (const job of jobs) {
    const siteTz = job.serviceLocation.timezone ?? orgTz
    if (!isInBillingPeriod(job.scheduledStart, siteTz, input.periodStart, input.periodEnd)) continue
    const plan = job.servicePlan
    const serviceDate = job.actualEnd ?? job.scheduledStart
    const siteName = job.serviceLocation.name

    if (plan?.billingMode === "FLAT_PERIOD") {
      const arr = coveredByPlan.get(plan.id) ?? coveredByPlan.set(plan.id, []).get(plan.id)!
      arr.push({ id: job.id, title: job.title, siteName, serviceDate, scheduledStart: job.scheduledStart, siteTz, claimed: job.invoiceLines.length > 0 })
      continue // never per-job billed
    }

    if (opts.flatOnly) continue
    if (job.invoiceLines.length > 0) continue // already on a non-VOID invoice
    if (!plan || plan.rate == null) {
      excluded.push({ jobId: job.id, title: job.title, reason: "No billing rate on the service plan" })
      continue
    }
    const rate = plan.rate as Money
    const jobCurrency = plan.currency ?? "USD"
    if (currency === null) currency = jobCurrency
    else if (jobCurrency !== currency) {
      excluded.push({ jobId: job.id, title: job.title, reason: `Different currency (${jobCurrency}) — invoice separately` })
      continue
    }

    if (plan.billingType === "HOURLY") {
      const pending = job.timeEntries.filter((e) => e.status === "OPEN" || e.status === "COMPLETED")
      if (pending.length > 0) {
        excluded.push({ jobId: job.id, title: job.title, reason: "Has unapproved time — approve it first" })
        continue
      }
      const minutes = job.timeEntries.filter((e) => e.status === "APPROVED").reduce((sum, e) => sum + billableMinutes(e), 0)
      if (minutes <= 0) {
        excluded.push({ jobId: job.id, title: job.title, reason: "No approved time to bill" })
        continue
      }
      const { quantity, amount } = hourlyLine(minutes, rate)
      drafts.push({ jobId: job.id, activeJobId: job.id, activePeriodKey: null, billable: true, description: job.title, siteName, serviceDate, quantity, unitRate: rate, amount })
    } else {
      const { quantity, amount } = flatLine(rate)
      drafts.push({ jobId: job.id, activeJobId: job.id, activePeriodKey: null, billable: true, description: job.title, siteName, serviceDate, quantity, unitRate: rate, amount })
    }
  }

  // ── Flat-period charges ──
  for (const plan of flatPlans) {
    const siteTz = plan.serviceLocation.timezone ?? orgTz
    if (plan.periodAmount == null || plan.periodFrequency == null) {
      excluded.push({ jobId: plan.id, title: plan.name, reason: "Flat plan missing a period amount or frequency" })
      continue
    }
    const planCurrency = plan.currency ?? "USD"
    if (currency === null) currency = planCurrency
    else if (planCurrency !== currency) {
      excluded.push({ jobId: plan.id, title: plan.name, reason: `Different currency (${planCurrency}) — invoice separately` })
      continue
    }
    const amount = round2(plan.periodAmount as Money)
    const covered = coveredByPlan.get(plan.id) ?? []
    const periods = periodsInWindow(plan.periodFrequency, input.periodStart, input.periodEnd, siteTz)
    for (const period of periods) {
      if (opts.endedOnly && period.end.getTime() > now.getTime()) continue // period hasn't ended yet
      const periodKey = `${plan.id}:${period.key}`
      // Flat charge (billable).
      drafts.push({
        jobId: null,
        activeJobId: null,
        activePeriodKey: periodKey,
        billable: true,
        description: `${plan.name} — ${period.label}`,
        siteName: plan.serviceLocation.name,
        serviceDate: period.end,
        quantity: new Prisma.Decimal(1),
        unitRate: amount,
        amount,
      })
      // Covered visits for this period (non-billable detail; claim them).
      for (const cj of covered) {
        if (cj.claimed) continue
        if (!isInBillingPeriod(cj.scheduledStart, cj.siteTz, period.startISO, period.endISO)) continue
        drafts.push({
          jobId: cj.id,
          activeJobId: cj.id,
          activePeriodKey: null,
          billable: false,
          description: `Visit: ${cj.title}`,
          siteName: cj.siteName,
          serviceDate: cj.serviceDate,
          quantity: new Prisma.Decimal(1),
          unitRate: ZERO,
          amount: ZERO,
        })
      }
    }
  }

  const hasBillable = (ls: LineDraft[]) => ls.some((l) => l.billable)
  if (!hasBillable(drafts)) {
    return { created: false, reason: opts.flatOnly ? "No flat-period charges due in this window" : "No billable work in this period", excluded }
  }
  const invoiceCurrency = currency ?? "USD"

  const issueDate = new Date()
  const dueDate = dueDateFromTerms(issueDate, customer!.paymentTerms)

  // Create with retry. A P2002 is an invoiceNumber race (retry a fresh number),
  // an activeJobId race (a visit was claimed elsewhere), or an activePeriodKey
  // race (a flat period was billed elsewhere). Drop the contested lines (and a
  // flat charge's orphaned detail) and retry — never double-bills.
  let lines = drafts
  for (let attempt = 0; attempt < 5; attempt++) {
    const subtotal = lines.reduce((acc, l) => acc.plus(l.amount), ZERO)
    const agg = await db.invoice.aggregate({ _max: { invoiceNumber: true } })
    const invoiceNumber = (agg._max.invoiceNumber ?? 0) + 1
    try {
      const invoice = await db.invoice.create({
        data: {
          organizationId: orgId,
          customerId: input.customerId,
          invoiceNumber,
          status: "DRAFT",
          issueDate,
          dueDate,
          periodStart,
          periodEnd,
          currency: invoiceCurrency,
          subtotal,
          taxTotal: ZERO,
          total: subtotal,
          lines: {
            create: lines.map((l) => ({
              jobId: l.jobId,
              activeJobId: l.activeJobId,
              activePeriodKey: l.activePeriodKey,
              billable: l.billable,
              description: l.description,
              siteName: l.siteName,
              serviceDate: l.serviceDate,
              quantity: l.quantity,
              unitRate: l.unitRate,
              amount: l.amount,
            })),
          },
        },
        select: { id: true, invoiceNumber: true, total: true },
      })
      return {
        created: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        lineCount: lines.length,
        total: invoice.total.toFixed(2),
        excluded,
      }
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      const jobIds = lines.map((l) => l.activeJobId).filter((x): x is string => !!x)
      const periodKeys = lines.map((l) => l.activePeriodKey).filter((x): x is string => !!x)
      const [takenJobs, takenPeriods] = await Promise.all([
        jobIds.length ? db.invoiceLine.findMany({ where: { activeJobId: { in: jobIds } }, select: { activeJobId: true } }) : Promise.resolve([]),
        periodKeys.length ? db.invoiceLine.findMany({ where: { activePeriodKey: { in: periodKeys } }, select: { activePeriodKey: true } }) : Promise.resolve([]),
      ])
      const takenJobSet = new Set(takenJobs.map((t) => t.activeJobId))
      const takenPeriodSet = new Set(takenPeriods.map((t) => t.activePeriodKey))
      if (takenJobSet.size > 0 || takenPeriodSet.size > 0) {
        for (const l of lines) {
          if (l.billable && l.activeJobId && takenJobSet.has(l.activeJobId)) excluded.push({ jobId: l.activeJobId, title: l.description, reason: "Already invoiced" })
          if (l.activePeriodKey && takenPeriodSet.has(l.activePeriodKey)) excluded.push({ jobId: l.activePeriodKey, title: l.description, reason: "Period already invoiced" })
        }
        // Drop contested period charges and contested visit claims.
        const droppedPeriods = new Set(lines.filter((l) => l.activePeriodKey && takenPeriodSet.has(l.activePeriodKey)).map((l) => l.activePeriodKey))
        lines = lines.filter((l) => {
          if (l.activePeriodKey && takenPeriodSet.has(l.activePeriodKey)) return false
          if (l.activeJobId && takenJobSet.has(l.activeJobId)) return false
          return true
        })
        // A dropped flat charge may leave detail lines whose period is gone —
        // they're harmless (amount 0, still claim the visit), so keep them.
        void droppedPeriods
        if (!hasBillable(lines)) return { created: false, reason: "Everything was already invoiced", excluded }
      }
      // else: pure invoiceNumber race — loop retries with a fresh number.
    }
  }
  throw new ConflictError("Could not assign an invoice number — please try again")
}

// ─── Reads ───────────────────────────────────────────────────────────────────

function balanceOf(total: Money, payments: { amount: Money }[]): Money {
  const paid = payments.reduce((acc, p) => acc.plus(p.amount), ZERO)
  return total.minus(paid)
}

export async function listInvoices(orgId: string, filter: { status?: string; customerId?: string } = {}) {
  const where: Record<string, unknown> = {}
  if (filter.status) where.status = filter.status
  if (filter.customerId) where.customerId = filter.customerId
  const invoices = await orgDb(orgId).invoice.findMany({
    where,
    orderBy: { invoiceNumber: "desc" },
    include: { customer: { select: { id: true, name: true } }, payments: { select: { amount: true } } },
  })
  return invoices.map((inv) => ({ ...inv, balance: balanceOf(inv.total, inv.payments) }))
}

export function getInvoice(orgId: string, id: string) {
  return orgDb(orgId).invoice.findFirst({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { serviceDate: "asc" } },
      payments: { orderBy: { receivedDate: "asc" } },
    },
  })
}

// MANUAL transitions only. PAID / PARTIALLY_PAID are never set by hand — they
// derive from payments (see recordPayment). Users only "send" and "void".
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["VOID"],
  PARTIALLY_PAID: ["VOID"],
  PAID: ["VOID"],
  VOID: [],
}

export async function setInvoiceStatus(orgId: string, id: string, status: Extract<InvoiceStatusValue, "SENT" | "VOID">) {
  const db = orgDb(orgId)
  const invoice = await db.invoice.findFirst({ where: { id }, select: { id: true, status: true } })
  if (!invoice) return null
  if (invoice.status === status) return getInvoice(orgId, id)
  const allowed = ALLOWED_TRANSITIONS[invoice.status] ?? []
  if (!allowed.includes(status)) {
    throw new ConflictError(`Cannot move an invoice from ${invoice.status} to ${status}`)
  }
  if (status === "VOID") {
    // Release the claims so visits and flat periods can be re-invoiced
    // (activeJobId / activePeriodKey → NULL), atomically.
    await db.$transaction([
      db.invoice.updateMany({ where: { id }, data: { status } }),
      db.invoiceLine.updateMany({ where: { invoiceId: id }, data: { activeJobId: null, activePeriodKey: null } }),
    ])
  } else {
    await db.invoice.updateMany({ where: { id }, data: { status } })
  }
  return getInvoice(orgId, id)
}

export async function addInvoicePayment(
  orgId: string,
  invoiceId: string,
  input: { amount: string; receivedDate?: string; method?: string; reference?: string },
) {
  const db = orgDb(orgId)
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId },
    select: { id: true, status: true, total: true, payments: { select: { amount: true } } },
  })
  if (!invoice) return null
  if (invoice.status === "VOID") throw new ConflictError("Cannot record a payment on a voided invoice")
  if (invoice.status === "DRAFT") throw new ConflictError("Send the invoice before recording a payment")

  const amount = new Prisma.Decimal(input.amount)
  const alreadyPaid = invoice.payments.reduce((acc, p) => acc.plus(p.amount), ZERO)
  // Refuse overpayment rather than silently creating a negative balance.
  if (overpays(invoice.total, alreadyPaid, amount)) {
    throw new ConflictError(
      `Payment of ${amount.toFixed(2)} exceeds the remaining balance of ${remainingBalance(invoice.total, alreadyPaid).toFixed(2)}`,
    )
  }

  const paid = alreadyPaid.plus(amount)
  const nextStatus = deriveInvoiceStatus(invoice.status, invoice.total, paid)
  // Record the payment and set the DERIVED status atomically.
  await db.$transaction([
    db.invoicePayment.create({
      data: {
        invoiceId,
        amount,
        receivedDate: input.receivedDate ? startOfUtcDay(input.receivedDate) : new Date(),
        method: input.method,
        reference: input.reference,
      },
    }),
    db.invoice.updateMany({ where: { id: invoiceId }, data: { status: nextStatus } }),
  ])
  return getInvoice(orgId, invoiceId)
}

// ─── AR aging ────────────────────────────────────────────────────────────────

export type AgingRow = {
  customerId: string
  customerName: string
  current: Money
  d1_30: Money
  d31_60: Money
  d61_90: Money
  d90: Money
  total: Money
}

export async function getArAging(orgId: string, now: Date = new Date()) {
  // Outstanding AR = issued invoices (SENT or PARTIALLY_PAID) with a balance.
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { status: { in: [...OUTSTANDING_STATUSES] } },
    include: { customer: { select: { id: true, name: true } }, payments: { select: { amount: true } } },
  })

  const rows = new Map<string, AgingRow>()
  let totals = { current: ZERO, d1_30: ZERO, d31_60: ZERO, d61_90: ZERO, d90: ZERO, total: ZERO }

  for (const inv of invoices) {
    const bal = balanceOf(inv.total, inv.payments)
    if (bal.lessThanOrEqualTo(ZERO)) continue
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000)
    const bucket = agingBucket(daysOverdue)

    let row = rows.get(inv.customerId)
    if (!row) {
      row = { customerId: inv.customerId, customerName: inv.customer.name, current: ZERO, d1_30: ZERO, d31_60: ZERO, d61_90: ZERO, d90: ZERO, total: ZERO }
      rows.set(inv.customerId, row)
    }
    row[bucket] = row[bucket].plus(bal)
    row.total = row.total.plus(bal)
    totals = {
      current: bucket === "current" ? totals.current.plus(bal) : totals.current,
      d1_30: bucket === "d1_30" ? totals.d1_30.plus(bal) : totals.d1_30,
      d31_60: bucket === "d31_60" ? totals.d31_60.plus(bal) : totals.d31_60,
      d61_90: bucket === "d61_90" ? totals.d61_90.plus(bal) : totals.d61_90,
      d90: bucket === "d90" ? totals.d90.plus(bal) : totals.d90,
      total: totals.total.plus(bal),
    }
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.customerName.localeCompare(b.customerName)),
    totals,
  }
}

/** Recent payments across all invoices (reached through the org-scoped invoice). */
export async function listRecentPayments(orgId: string, limit = 200) {
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { payments: { some: {} } },
    select: {
      id: true,
      invoiceNumber: true,
      currency: true,
      customer: { select: { name: true } },
      payments: { orderBy: { receivedDate: "desc" } },
    },
  })
  const rows = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      receivedDate: p.receivedDate,
      method: p.method,
      reference: p.reference,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      customerName: inv.customer.name,
    })),
  )
  rows.sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime())
  return rows.slice(0, limit)
}

/** Customer billing summary — outstanding balance, invoice history, payment history. */
export async function getCustomerBilling(orgId: string, customerId: string) {
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { customerId },
    orderBy: { invoiceNumber: "desc" },
    include: { payments: { orderBy: { receivedDate: "desc" } } },
  })
  const withBalance = invoices.map((inv) => ({ ...inv, balance: balanceOf(inv.total, inv.payments) }))
  const outstanding = withBalance
    .filter((inv) => (OUTSTANDING_STATUSES as readonly string[]).includes(inv.status))
    .reduce((acc, inv) => acc.plus(inv.balance), ZERO)
  // Flattened payment history across the customer's invoices, newest first.
  const payments = invoices
    .flatMap((inv) => inv.payments.map((p) => ({ ...p, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, currency: inv.currency })))
    .sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime())
  return { invoices: withBalance, outstanding, payments }
}

/** Overdue = issued, past due, still owing. For the dashboard indicator. */
export async function countOverdue(orgId: string, now: Date = new Date()): Promise<number> {
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { status: { in: [...OUTSTANDING_STATUSES] }, dueDate: { lt: now } },
    select: { total: true, payments: { select: { amount: true } } },
  })
  return invoices.filter((inv) => balanceOf(inv.total, inv.payments).greaterThan(ZERO)).length
}
