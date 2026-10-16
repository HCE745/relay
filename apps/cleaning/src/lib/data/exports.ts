import { orgDb } from "../org-db"
import { invoiceNo } from "../money"
import { startOfUtcDay, endOfUtcDay } from "../billing-math"
import { getPeriodOvertime } from "./labor"
import {
  qboInvoicesCsv, xeroInvoicesCsv, qboCustomersCsv, xeroContactsCsv, gustoHoursCsv, adpHoursCsv, payrollEarningsCsv,
  type ExportInvoice, type ExportCustomer, type ExportHours, type ExportPayrollRow,
} from "../csv-exports"

// Gather-and-shape for the CSV exports (Phase 15). Each builder returns the CSV
// text + a filename + the row count; the caller records an ExportRun.

const iso = (d: Date) => d.toISOString().slice(0, 10)

async function invoiceRows(orgId: string, start: Date, end: Date): Promise<ExportInvoice[]> {
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { status: { not: "VOID" }, issueDate: { gte: start, lte: end } },
    orderBy: { invoiceNumber: "asc" },
    include: { customer: { select: { name: true } }, lines: { where: { billable: true }, orderBy: { serviceDate: "asc" } } },
  })
  return invoices.map((inv) => ({
    invoiceNo: invoiceNo(inv.invoiceNumber),
    customer: inv.customer.name,
    invoiceDate: iso(inv.issueDate),
    dueDate: iso(inv.dueDate),
    lines: inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), rate: l.unitRate.toString(), amount: l.amount.toString() })),
  }))
}

async function customerRows(orgId: string): Promise<ExportCustomer[]> {
  const customers = await orgDb(orgId).customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  return customers.map((c) => ({ name: c.name, email: c.billingEmail ?? c.email ?? null, phone: c.phone ?? null, address: c.billingAddress ?? null }))
}

async function hoursRows(orgId: string, start: Date, end: Date): Promise<ExportHours[]> {
  // Regular vs OT hours now come from the org's overtime rules (Phase 24).
  const [entries, ot] = await Promise.all([
    orgDb(orgId).timeEntry.findMany({
      where: { status: "APPROVED", clockInAt: { gte: start, lte: end } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    getPeriodOvertime(orgId, { start, end }),
  ])
  const email = new Map(entries.map((e) => [e.user.id, { name: e.user.name, email: e.user.email }]))
  return ot.byUser.map((u) => {
    const meta = email.get(u.userId)
    const [firstName, ...rest] = (meta?.name ?? u.name).split(" ")
    return {
      employeeId: u.userId,
      firstName,
      lastName: rest.join(" "),
      email: meta?.email ?? null,
      regularHours: String(u.regularHours),
      overtimeHours: String(u.otHours),
    }
  })
}

// Hours + commission/flat earnings as distinct columns (Phase 37).
async function payrollRows(orgId: string, start: Date, end: Date): Promise<ExportPayrollRow[]> {
  const [hours, earnings] = await Promise.all([
    hoursRows(orgId, start, end),
    orgDb(orgId).jobEarning.groupBy({
      by: ["userId", "status"],
      where: { job: { scheduledStart: { gte: start, lte: end } } },
      _sum: { amount: true }, _count: true,
    }),
  ])
  type Agg = { name: string; email: string | null; regular: string; ot: string; calc: number; pending: number; jobs: number }
  const byUser = new Map<string, Agg>()
  for (const h of hours) {
    byUser.set(h.employeeId, { name: `${h.firstName} ${h.lastName}`.trim(), email: h.email, regular: h.regularHours, ot: h.overtimeHours, calc: 0, pending: 0, jobs: 0 })
  }
  // Names for earners who have no approved hours in the window.
  const extraIds = earnings.map((e) => e.userId).filter((id) => !byUser.has(id))
  if (extraIds.length) {
    const users = await orgDb(orgId).user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, email: true } })
    for (const u of users) byUser.set(u.id, { name: u.name, email: u.email, regular: "0", ot: "0", calc: 0, pending: 0, jobs: 0 })
  }
  for (const e of earnings) {
    const agg = byUser.get(e.userId)
    if (!agg) continue
    const amt = Number(e._sum.amount ?? 0)
    if (e.status === "CALCULATED") { agg.calc += amt; agg.jobs += e._count }
    else if (e.status === "PENDING") agg.pending += amt
  }
  return [...byUser.entries()].map(([employeeId, a]) => ({
    employeeId, name: a.name, email: a.email, regularHours: a.regular, overtimeHours: a.ot,
    commissionEarnings: a.calc.toFixed(2), jobsWithEarnings: a.jobs, pendingEarnings: a.pending.toFixed(2),
  }))
}

export type ExportKind = "QBO_INVOICES" | "QBO_CUSTOMERS" | "XERO_INVOICES" | "XERO_CONTACTS" | "GUSTO_HOURS" | "ADP_HOURS" | "PAYROLL_EARNINGS"

export async function buildExport(
  orgId: string,
  kind: ExportKind,
  opts: { periodStart?: string; periodEnd?: string },
): Promise<{ csv: string; filename: string; rowCount: number }> {
  const needsPeriod = kind === "QBO_INVOICES" || kind === "XERO_INVOICES" || kind === "GUSTO_HOURS" || kind === "ADP_HOURS" || kind === "PAYROLL_EARNINGS"
  const start = startOfUtcDay(opts.periodStart ?? "1970-01-01")
  const end = opts.periodEnd ? endOfUtcDay(opts.periodEnd) : new Date()
  const tag = needsPeriod ? `_${opts.periodStart ?? "all"}_${opts.periodEnd ?? iso(end)}` : ""

  switch (kind) {
    case "QBO_INVOICES": {
      const rows = await invoiceRows(orgId, start, end)
      return { csv: qboInvoicesCsv(rows), filename: `qbo_invoices${tag}.csv`, rowCount: rows.length }
    }
    case "XERO_INVOICES": {
      const rows = await invoiceRows(orgId, start, end)
      return { csv: xeroInvoicesCsv(rows), filename: `xero_invoices${tag}.csv`, rowCount: rows.length }
    }
    case "QBO_CUSTOMERS": {
      const rows = await customerRows(orgId)
      return { csv: qboCustomersCsv(rows), filename: `qbo_customers.csv`, rowCount: rows.length }
    }
    case "XERO_CONTACTS": {
      const rows = await customerRows(orgId)
      return { csv: xeroContactsCsv(rows), filename: `xero_contacts.csv`, rowCount: rows.length }
    }
    case "GUSTO_HOURS": {
      const rows = await hoursRows(orgId, start, end)
      return { csv: gustoHoursCsv(rows), filename: `gusto_hours${tag}.csv`, rowCount: rows.length }
    }
    case "ADP_HOURS": {
      const rows = await hoursRows(orgId, start, end)
      return { csv: adpHoursCsv(rows), filename: `adp_hours${tag}.csv`, rowCount: rows.length }
    }
    case "PAYROLL_EARNINGS": {
      const rows = await payrollRows(orgId, start, end)
      return { csv: payrollEarningsCsv(rows), filename: `payroll_earnings${tag}.csv`, rowCount: rows.length }
    }
  }
}

export async function recordExport(
  orgId: string,
  kind: ExportKind,
  opts: { periodStart?: string; periodEnd?: string; rowCount: number; userId?: string; userName?: string },
) {
  return orgDb(orgId).exportRun.create({
    data: {
      organizationId: orgId,
      type: kind,
      periodStart: opts.periodStart ? startOfUtcDay(opts.periodStart) : null,
      periodEnd: opts.periodEnd ? endOfUtcDay(opts.periodEnd) : null,
      rowCount: opts.rowCount,
      createdById: opts.userId,
      createdByName: opts.userName,
    },
  })
}

export function listExportHistory(orgId: string) {
  return orgDb(orgId).exportRun.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
}
