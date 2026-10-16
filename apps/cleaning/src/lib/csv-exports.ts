// Pure CSV builders for the documented import formats of QuickBooks Online,
// Xero, Gusto and ADP (Phase 15). No DB, no network — just shape → CSV string,
// so each format is unit-testable. CSV-safe quoting throughout.

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n")
}

// ── Invoices ──
export type ExportInvoice = {
  invoiceNo: string
  customer: string
  invoiceDate: string // YYYY-MM-DD
  dueDate: string
  lines: { description: string; quantity: number; rate: string; amount: string }[]
}

// QuickBooks Online invoice import: one row per line item.
export function qboInvoicesCsv(invoices: ExportInvoice[]): string {
  const headers = ["InvoiceNo", "Customer", "InvoiceDate", "DueDate", "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount"]
  const rows = invoices.flatMap((inv) =>
    inv.lines.map((l) => [inv.invoiceNo, inv.customer, inv.invoiceDate, inv.dueDate, l.description, l.quantity, l.rate, l.amount]),
  )
  return toCsv(headers, rows)
}

// Xero sales-invoice (precoded) import: required columns prefixed with *.
export function xeroInvoicesCsv(invoices: ExportInvoice[]): string {
  const headers = ["*ContactName", "*InvoiceNumber", "*InvoiceDate", "*DueDate", "Description", "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType"]
  const rows = invoices.flatMap((inv) =>
    inv.lines.map((l) => [inv.customer, inv.invoiceNo, inv.invoiceDate, inv.dueDate, l.description, l.quantity, l.rate, "200", "Tax Exempt"]),
  )
  return toCsv(headers, rows)
}

// ── Customers / contacts ──
export type ExportCustomer = { name: string; email: string | null; phone: string | null; address: string | null }

export function qboCustomersCsv(customers: ExportCustomer[]): string {
  const headers = ["Customer", "Email", "Phone", "Billing Address"]
  return toCsv(headers, customers.map((c) => [c.name, c.email, c.phone, c.address]))
}

export function xeroContactsCsv(customers: ExportCustomer[]): string {
  const headers = ["*ContactName", "EmailAddress", "POAddressLine1", "PhoneNumber"]
  return toCsv(headers, customers.map((c) => [c.name, c.email, c.address, c.phone]))
}

// ── Payroll hours ──
export type ExportHours = { employeeId: string; firstName: string; lastName: string; email: string | null; regularHours: string; overtimeHours: string }

// Gusto payroll hours import.
export function gustoHoursCsv(rows: ExportHours[]): string {
  const headers = ["First Name", "Last Name", "Employee Email", "Regular Hours", "Overtime Hours"]
  return toCsv(headers, rows.map((r) => [r.firstName, r.lastName, r.email, r.regularHours, r.overtimeHours]))
}

// ADP paydata import.
export function adpHoursCsv(rows: ExportHours[]): string {
  const headers = ["Employee ID", "Employee Name", "Regular Hours", "Overtime Hours"]
  return toCsv(headers, rows.map((r) => [r.employeeId, `${r.firstName} ${r.lastName}`.trim(), r.regularHours, r.overtimeHours]))
}

// Combined payroll earnings (Phase 37): hours AND commission/flat earnings as
// DISTINCT columns, so a bookkeeper sees both without picking one format. This
// is an amounts-for-export view, not payroll processing (no tax/withholding).
export type ExportPayrollRow = {
  employeeId: string
  name: string
  email: string | null
  regularHours: string
  overtimeHours: string
  commissionEarnings: string // sum of CALCULATED commission/flat earnings
  jobsWithEarnings: number
  pendingEarnings: string // awaiting a billable amount (not yet payable)
}
export function payrollEarningsCsv(rows: ExportPayrollRow[]): string {
  const headers = ["Employee ID", "Employee Name", "Email", "Regular Hours", "Overtime Hours", "Commission/Flat Earnings", "Jobs With Earnings", "Pending Earnings"]
  return toCsv(headers, rows.map((r) => [r.employeeId, r.name, r.email, r.regularHours, r.overtimeHours, r.commissionEarnings, r.jobsWithEarnings, r.pendingEarnings]))
}
