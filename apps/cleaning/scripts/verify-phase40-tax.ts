// Phase 40 integration verification: sales tax.
//  - NOT taxable by default: a site with no tax config yields taxTotal 0
//  - a taxable site applies its jurisdiction rate; taxTotal = round2(amount×rate)
//  - the rate is SNAPSHOTTED on the line; editing the rate never rewrites a
//    historical invoice, but a NEW invoice picks up the new rate
//  - tax flows into total (and therefore AR / balance)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase40-tax.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { generateInvoice, getInvoice } from "../src/lib/data/invoices"
import { createTaxRate, updateTaxRate, setSiteTaxability } from "../src/lib/data/tax-rates"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function completedJob(orgId: string, siteId: string, planId: string, when: Date) {
  return systemDb.job.create({
    data: {
      organizationId: orgId, serviceLocationId: siteId, servicePlanId: planId, title: "Monthly clean",
      status: "COMPLETED", plannedStart: when, scheduledStart: when, scheduledEnd: when, actualEnd: when,
      crewSize: 1, createdById: null,
    },
    select: { id: true },
  })
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Tax Co", slug: `tx-${stamp}`, packageTier: "ENTERPRISE", timezone: "America/Chicago" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme", paymentTerms: "NET_30" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "America/Chicago" } })
  const plan = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Janitorial", billingType: "FLAT_PER_JOB", rate: "1000.00", currency: "USD", billingMode: "PER_JOB" },
    select: { id: true },
  })

  const period = { periodStart: "2026-06-01", periodEnd: "2026-06-30" }
  const when = new Date("2026-06-15T14:00:00.000Z")

  console.log("Default = NOT taxable:")
  await completedJob(org.id, site.id, plan.id, when)
  const r1 = await generateInvoice(org.id, { customerId: cust.id, ...period })
  check("invoice generated", r1.created === true)
  if (r1.created) {
    const inv = await getInvoice(org.id, r1.invoiceId)
    check("taxTotal is 0 with no tax config", inv!.taxTotal.toFixed(2) === "0.00")
    check("total equals subtotal", inv!.total.toFixed(2) === inv!.subtotal.toFixed(2))
    await orgDb(org.id).invoice.updateMany({ where: { id: r1.invoiceId }, data: { status: "VOID" } })
    await orgDb(org.id).invoiceLine.updateMany({ where: { invoiceId: r1.invoiceId }, data: { activeJobId: null } })
  }

  console.log("\nTaxable site at 7%:")
  const rate = await createTaxRate(org.id, { name: "Indiana sales tax", jurisdiction: "Indiana", ratePct: "7" })
  await setSiteTaxability(org.id, site.id, { taxable: true, taxRateId: rate.id })
  await completedJob(org.id, site.id, plan.id, new Date("2026-07-15T14:00:00.000Z"))
  const r2 = await generateInvoice(org.id, { customerId: cust.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" })
  check("taxable invoice generated", r2.created === true)
  let firstInvoiceId = ""
  if (r2.created) {
    firstInvoiceId = r2.invoiceId
    const inv = await getInvoice(org.id, r2.invoiceId)
    check("taxTotal = 7% of 1000 = 70.00", inv!.taxTotal.toFixed(2) === "70.00")
    check("total = 1070.00", inv!.total.toFixed(2) === "1070.00")
    const line = inv!.lines.find((l) => l.billable)!
    check("line snapshots the rate fraction 0.0700", line.taxRatePct?.toFixed(4) === "0.0700")
    check("line snapshots the jurisdiction name", line.taxRateName === "Indiana sales tax")
    check("line taxAmount = 70.00", line.taxAmount.toFixed(2) === "70.00")
  }

  console.log("\nEditing the rate does NOT rewrite history; a new invoice uses the new rate:")
  await updateTaxRate(org.id, rate.id, { ratePct: "9" })
  const stillOld = await getInvoice(org.id, firstInvoiceId)
  check("historical invoice still 70.00 tax", stillOld!.taxTotal.toFixed(2) === "70.00")
  await completedJob(org.id, site.id, plan.id, new Date("2026-08-15T14:00:00.000Z"))
  const r3 = await generateInvoice(org.id, { customerId: cust.id, periodStart: "2026-08-01", periodEnd: "2026-08-31" })
  if (r3.created) {
    const inv = await getInvoice(org.id, r3.invoiceId)
    check("new invoice uses 9% = 90.00", inv!.taxTotal.toFixed(2) === "90.00")
  } else check("new invoice generated", false)

  console.log("\nTurning taxability off returns to untaxed:")
  await setSiteTaxability(org.id, site.id, { taxable: false, taxRateId: null })
  await completedJob(org.id, site.id, plan.id, new Date("2026-09-15T14:00:00.000Z"))
  const r4 = await generateInvoice(org.id, { customerId: cust.id, periodStart: "2026-09-01", periodEnd: "2026-09-30" })
  if (r4.created) {
    const inv = await getInvoice(org.id, r4.invoiceId)
    check("untaxed again → taxTotal 0", inv!.taxTotal.toFixed(2) === "0.00")
  } else check("untaxed invoice generated", false)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL TAX CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
