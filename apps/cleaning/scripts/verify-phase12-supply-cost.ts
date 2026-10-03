// Phase 12 integration verification. Focus: supply usage snapshots cost at time
// of use; that cost is allocated to the job, and rolls up to site and customer;
// profitability margin = revenue − labor − supplies; the supply-spend-by-site
// report sums allocated cost; and re-pricing the supply later does NOT change
// an already-recorded allocation.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase12-supply-cost.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { recordSupplyUsage } from "../src/lib/data/supplies"
import { getProfitability, getJobProfitability, getSupplySpendBySite } from "../src/lib/data/profitability"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
const money = (d: { toString(): string }) => d.toString()

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Supply Cost Test", slug: `sc-${stamp}`, packageTier: "BUSINESS", timezone: "UTC" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Al", email: `al-${stamp}@t.co`, password: "x", role: "CLEANER", employeeProfile: { create: { organizationId: org.id, payType: "HOURLY", payRate: "20.00" } } } })
  const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: "Nightly", billingType: "FLAT_PER_JOB", rate: "300.00" } })
  const supply = await systemDb.supply.create({ data: { organizationId: org.id, name: "Floor soap", unit: "gal", currentStock: "100", costPerUnit: "5.00" } })

  // A completed, invoiced job with approved hourly labor.
  const job = await systemDb.job.create({
    data: {
      organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Night clean", status: "COMPLETED",
      scheduledStart: new Date("2026-06-10T09:00:00Z"), actualEnd: new Date("2026-06-10T11:00:00Z"),
    },
  })
  await systemDb.jobAssignment.create({ data: { organizationId: org.id, jobId: job.id, userId: cleaner.id } })
  // 2h approved labor @ $20 = $40.
  await systemDb.timeEntry.create({
    data: { organizationId: org.id, jobId: job.id, userId: cleaner.id, status: "APPROVED", clockInAt: new Date("2026-06-10T09:00:00Z"), clockOutAt: new Date("2026-06-10T11:00:00Z"), breakMinutes: 0, approvedPayType: "HOURLY", approvedPayRate: "20.00" },
  })
  // Invoice line = $300 revenue (claims the job).
  await systemDb.invoice.create({
    data: {
      organizationId: org.id, customerId: cust.id, invoiceNumber: 1, status: "SENT", dueDate: new Date("2026-07-10T00:00:00Z"),
      periodStart: new Date("2026-06-01T00:00:00Z"), periodEnd: new Date("2026-06-30T23:59:59Z"), subtotal: "300", total: "300",
      lines: { create: [{ jobId: job.id, activeJobId: job.id, description: "Night clean", serviceDate: new Date("2026-06-10T11:00:00Z"), quantity: "1", unitRate: "300", amount: "300" }] },
    },
  })

  console.log("Supply usage snapshots cost at time of use:")
  await recordSupplyUsage(org.id, cleaner.id, job.id, { supplyId: supply.id, quantity: "4" }) // 4 gal × $5 = $20
  const usage = await systemDb.supplyUsage.findFirst({ where: { jobId: job.id } })
  check("usage recorded with a snapshotted costPerUnit", money(usage!.costPerUnit!) === "5", money(usage!.costPerUnit ?? "null"))

  console.log("Re-pricing the supply later does NOT change the recorded allocation:")
  await systemDb.supply.update({ where: { id: supply.id }, data: { costPerUnit: "9.99" } })
  const usageAfter = await systemDb.supplyUsage.findFirst({ where: { jobId: job.id } })
  check("snapshot is immutable (still $5, not $9.99)", money(usageAfter!.costPerUnit!) === "5")

  console.log("Allocation flows to job, site and customer; margin = revenue − labor − supplies:")
  const jp = await getJobProfitability(org.id, job.id)
  check("job supplies cost = 4 × $5 = $20", money(jp!.suppliesCost) === "20", money(jp!.suppliesCost))
  check("job gross margin = 300 − 40 − 20 = 240", jp!.grossMargin !== null && money(jp!.grossMargin) === "240", jp!.grossMargin ? money(jp!.grossMargin) : "null")

  const prof = await getProfitability(org.id, { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("summary supplies cost = $20", money(prof.summary.suppliesCost) === "20", money(prof.summary.suppliesCost))
  check("summary margin = 300 − 40 − 20 = 240", money(prof.summary.margin) === "240", money(prof.summary.margin))
  const siteRow = prof.bySite.find((r) => r.id === site.id)
  check("site row carries the supply cost", siteRow != null && money(siteRow.suppliesCost) === "20")
  const custRow = prof.byCustomer.find((r) => r.id === cust.id)
  check("customer row rolls up the supply cost", custRow != null && money(custRow.suppliesCost) === "20")

  console.log("Supply-spend-by-site report sums allocated cost:")
  const spend = await getSupplySpendBySite(org.id, { periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("total spend = $20", money(spend.total) === "20", money(spend.total))
  check("one site row with $20", spend.rows.length === 1 && money(spend.rows[0].cost) === "20")

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL SUPPLY-COST CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
