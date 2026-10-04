// Phase 15 integration verification. Focus: each export gathers the right data
// into the vendor's documented CSV shape, and every export is recorded in
// history with who/when/rows.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase15-exports.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { buildExport, recordExport, listExportHistory } from "../src/lib/data/exports"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Export Test", slug: `exp-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Globex", billingEmail: "ap@globex.co", phone: "555-0100", billingAddress: "1 Main St" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const al = await systemDb.user.create({ data: { organizationId: org.id, name: "Al Baker", email: "al@t.co", password: "x", role: "CLEANER" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Manager Mo", email: "mo@t.co", password: "x", role: "MANAGER" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Night", status: "COMPLETED", scheduledStart: new Date("2026-06-10T09:00:00Z") } })
  await systemDb.timeEntry.create({ data: { organizationId: org.id, jobId: job.id, userId: al.id, status: "APPROVED", clockInAt: new Date("2026-06-10T09:00:00Z"), clockOutAt: new Date("2026-06-10T13:00:00Z"), breakMinutes: 0 } })
  await systemDb.invoice.create({
    data: {
      organizationId: org.id, customerId: cust.id, invoiceNumber: 1, status: "SENT", issueDate: new Date("2026-06-11T00:00:00Z"), dueDate: new Date("2026-07-11T00:00:00Z"),
      periodStart: new Date("2026-06-01T00:00:00Z"), periodEnd: new Date("2026-06-30T23:59:59Z"), subtotal: "300", total: "300",
      lines: { create: [{ description: "Nightly clean", serviceDate: new Date("2026-06-10T13:00:00Z"), quantity: "1", unitRate: "300", amount: "300", billable: true }] },
    },
  })

  console.log("QuickBooks invoice export:")
  const qbo = await buildExport(org.id, "QBO_INVOICES", { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("QBO invoice CSV has the documented header", qbo.csv.startsWith("InvoiceNo,Customer,InvoiceDate,DueDate,ItemDescription,ItemQuantity,ItemRate,ItemAmount"))
  check("one invoice line exported", qbo.rowCount === 1, `rows=${qbo.rowCount}`)
  check("row carries the invoice number and amount", qbo.csv.includes("INV-0001") && qbo.csv.includes("300"))

  console.log("Xero invoice export:")
  const xero = await buildExport(org.id, "XERO_INVOICES", { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("Xero header has required-field asterisks", xero.csv.startsWith("*ContactName,*InvoiceNumber,*InvoiceDate,*DueDate"))

  console.log("Customer / contact exports:")
  const qc = await buildExport(org.id, "QBO_CUSTOMERS", {})
  check("QBO customers includes the customer + billing email", qc.csv.includes("Globex") && qc.csv.includes("ap@globex.co"))
  const xc = await buildExport(org.id, "XERO_CONTACTS", {})
  check("Xero contacts header", xc.csv.startsWith("*ContactName,EmailAddress,POAddressLine1,PhoneNumber"))

  console.log("Payroll hours exports (approved time → hours):")
  const gusto = await buildExport(org.id, "GUSTO_HOURS", { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("Gusto hours: 4h approved for Al, OT 0", gusto.csv.includes("Al,Baker,al@t.co,4,0"), gusto.csv.split("\r\n")[1])
  const adp = await buildExport(org.id, "ADP_HOURS", { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("ADP hours: combined name + 4h", adp.csv.includes("Al Baker,4,0"))

  console.log("Export history records who/when/rows:")
  await recordExport(org.id, "QBO_INVOICES", { periodStart: "2026-06-01", periodEnd: "2026-06-30", rowCount: qbo.rowCount, userId: mgr.id, userName: mgr.name })
  const hist = await listExportHistory(org.id)
  check("history has the recorded run", hist.length === 1 && hist[0].type === "QBO_INVOICES")
  check("history captures the actor and row count", hist[0].createdByName === "Manager Mo" && hist[0].rowCount === 1)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL EXPORT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
