import { orgDb } from "../org-db"
import { invoiceNo } from "../money"
import { billableMinutes, hoursFromMinutes, startOfUtcDay, endOfUtcDay } from "../billing-math"
import {
  qboInvoicesCsv, xeroInvoicesCsv, qboCustomersCsv, xeroContactsCsv, gustoHoursCsv, adpHoursCsv,
  type ExportInvoice, type ExportCustomer, type ExportHours,
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
  const entries = await orgDb(orgId).timeEntry.findMany({
    where: { status: "APPROVED", clockInAt: { gte: start, lte: end } },
    select: { clockInAt: true, clockOutAt: true, breakMinutes: true, user: { select: { id: true, name: true, email: true } } },
  })
  const byUser = new Map<string, { name: string; email: string | null; minutes: number }>()
  for (const e of entries) {
    const row = byUser.get(e.user.id) ?? { name: e.user.name, email: e.user.email, minutes: 0 }
    row.minutes += billableMinutes(e)
    byUser.set(e.user.id, row)
  }
  return [...byUser.entries()].map(([id, r]) => {
    const [firstName, ...rest] = r.name.split(" ")
    return {
      employeeId: id,
      firstName,
      lastName: rest.join(" "),
      email: r.email,
      regularHours: hoursFromMinutes(r.minutes).toString(),
      overtimeHours: "0", // we do not compute overtime — no OT ruleset in-app
    }
  })
}

export type ExportKind = "QBO_INVOICES" | "QBO_CUSTOMERS" | "XERO_INVOICES" | "XERO_CONTACTS" | "GUSTO_HOURS" | "ADP_HOURS"

export async function buildExport(
  orgId: string,
  kind: ExportKind,
  opts: { periodStart?: string; periodEnd?: string },
): Promise<{ csv: string; filename: string; rowCount: number }> {
  const needsPeriod = kind === "QBO_INVOICES" || kind === "XERO_INVOICES" || kind === "GUSTO_HOURS" || kind === "ADP_HOURS"
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
