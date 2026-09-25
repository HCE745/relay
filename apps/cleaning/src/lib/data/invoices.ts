import { orgDb, isUniqueViolation } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { getOrgTimezone } from "./org"
import { Prisma } from "../../generated/prisma/client"
import {
  type Money,
  type InvoiceStatusValue,
  ZERO,
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

export async function generateInvoice(
  orgId: string,
  input: { customerId: string; periodStart: string; periodEnd: string },
): Promise<GenerateInvoiceResult> {
  const db = orgDb(orgId)
  const customer = await db.customer.findFirst({
    where: { id: input.customerId },
    select: { id: true, paymentTerms: true },
  })
  assertFound(customer, "Customer")

  const periodStart = startOfUtcDay(input.periodStart)
  const periodEnd = endOfUtcDay(input.periodEnd)

  // Period membership is decided by the site's LOCAL wall-clock day (below), the
  // same timezone resolution the scheduler uses (site override, else org
  // default). We therefore fetch a widened UTC window — ±1 day covers every real
  // timezone offset — and let isInBillingPeriod() make the exact call, so a job
  // at 8pm local on the 31st stays on that month's invoice.
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
      servicePlan: { select: { name: true, billingType: true, rate: true, currency: true } },
      timeEntries: { select: { status: true, clockInAt: true, clockOutAt: true, breakMinutes: true } },
      // Non-empty only when this job already sits on a non-VOID invoice.
      invoiceLines: { where: { activeJobId: { not: null } }, select: { id: true } },
    },
  })

  const excluded: InvoiceExclusion[] = []
  type Draft = {
    jobId: string
    description: string
    siteName: string
    serviceDate: Date
    quantity: Money
    unitRate: Money
    amount: Money
  }
  const drafts: Draft[] = []
  // The first billable job (ordered by scheduledStart) sets the invoice currency;
  // jobs whose plan is in a different currency can't be summed onto it, so they
  // are excluded and reported back rather than silently mixed. One invoice is
  // one currency.
  let currency: string | null = null

  for (const job of jobs) {
    // Exact period membership by the site's local day (the window fetch above is
    // deliberately wider than the period).
    const siteTz = job.serviceLocation.timezone ?? orgTz
    if (!isInBillingPeriod(job.scheduledStart, siteTz, input.periodStart, input.periodEnd)) continue
    if (job.invoiceLines.length > 0) continue // already on a non-VOID invoice — idempotent skip
    const plan = job.servicePlan
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
    const serviceDate = job.actualEnd ?? job.scheduledStart
    const siteName = job.serviceLocation.name

    if (plan.billingType === "HOURLY") {
      const pending = job.timeEntries.filter((e) => e.status === "OPEN" || e.status === "COMPLETED")
      if (pending.length > 0) {
        excluded.push({ jobId: job.id, title: job.title, reason: "Has unapproved time — approve it first" })
        continue
      }
      const minutes = job.timeEntries
        .filter((e) => e.status === "APPROVED")
        .reduce((sum, e) => sum + billableMinutes(e), 0)
      if (minutes <= 0) {
        excluded.push({ jobId: job.id, title: job.title, reason: "No approved time to bill" })
        continue
      }
      const { quantity, amount } = hourlyLine(minutes, rate)
      drafts.push({ jobId: job.id, description: job.title, siteName, serviceDate, quantity, unitRate: rate, amount })
    } else {
      // FLAT_PER_JOB
      const { quantity, amount } = flatLine(rate)
      drafts.push({ jobId: job.id, description: job.title, siteName, serviceDate, quantity, unitRate: rate, amount })
    }
  }

  if (drafts.length === 0) {
    return { created: false, reason: "No billable completed jobs in this period", excluded }
  }
  const invoiceCurrency = currency ?? "USD" // guaranteed set when drafts is non-empty

  const issueDate = new Date()
  const dueDate = dueDateFromTerms(issueDate, customer!.paymentTerms)

  // Create with retry: a P2002 is either an invoiceNumber race (retry with a new
  // number) or an activeJobId race (another invoice claimed a job — drop it and
  // retry). Both converge without duplicates.
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
              activeJobId: l.jobId,
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
      // Drop any job that got claimed by another non-VOID invoice, then retry.
      const jobIds = lines.map((l) => l.jobId)
      const taken = await db.invoiceLine.findMany({
        where: { activeJobId: { in: jobIds } },
        select: { activeJobId: true },
      })
      const takenSet = new Set(taken.map((t) => t.activeJobId))
      if (takenSet.size > 0) {
        for (const l of lines) {
          if (takenSet.has(l.jobId)) excluded.push({ jobId: l.jobId, title: l.description, reason: "Already invoiced" })
        }
        lines = lines.filter((l) => !takenSet.has(l.jobId))
        if (lines.length === 0) return { created: false, reason: "All jobs were already invoiced", excluded }
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
    // Release the jobs so they can be re-invoiced (activeJobId → NULL), atomically.
    await db.$transaction([
      db.invoice.updateMany({ where: { id }, data: { status } }),
      db.invoiceLine.updateMany({ where: { invoiceId: id }, data: { activeJobId: null } }),
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
