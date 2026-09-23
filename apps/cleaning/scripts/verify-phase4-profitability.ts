// Phase 4 profitability integration verification against a live database.
// Exercises: pay-rate snapshot at approval, per-job + rolled-up margin, and that
// a later raise does NOT rewrite historical labor cost.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase4-profitability.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { approveTimeEntry } from "../src/lib/data/time-entries"
import { generateInvoice } from "../src/lib/data/invoices"
import { getProfitability, getJobProfitability } from "../src/lib/data/profitability"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({
    data: { name: "Profit Test", slug: `profit-${stamp}`, packageTier: "TEAM", timezone: "UTC" },
  })
  const owner = await systemDb.user.create({
    data: { organizationId: org.id, email: `owner-${stamp}@t.test`, name: "Owner", password: "x", role: "OWNER" },
  })
  const cleaner = await systemDb.user.create({
    data: {
      organizationId: org.id,
      email: `cleaner-${stamp}@t.test`,
      name: "Cleaner",
      password: "x",
      role: "CLEANER",
      employeeProfile: { create: { organizationId: org.id, payType: "HOURLY", payRate: "30.00" } },
    },
    include: { employeeProfile: true },
  })
  const customer = await systemDb.customer.create({
    data: { organizationId: org.id, name: "Acme", paymentTerms: "NET_15" },
  })
  const site = await systemDb.serviceLocation.create({
    data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" },
  })
  const plan = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Nightly", billingType: "FLAT_PER_JOB", rate: "200.00" },
  })
  const job = await systemDb.job.create({
    data: {
      organizationId: org.id,
      serviceLocationId: site.id,
      servicePlanId: plan.id,
      title: "Nightly clean",
      status: "COMPLETED",
      scheduledStart: new Date("2026-09-10T09:00:00Z"),
      actualEnd: new Date("2026-09-10T10:30:00Z"),
    },
  })
  // 90 minutes worked.
  const entry = await systemDb.timeEntry.create({
    data: {
      organizationId: org.id,
      userId: cleaner.id,
      jobId: job.id,
      status: "COMPLETED",
      clockInAt: new Date("2026-09-10T09:00:00Z"),
      clockOutAt: new Date("2026-09-10T10:30:00Z"),
    },
  })

  console.log("Approval snapshots the pay rate:")
  await approveTimeEntry(org.id, entry.id, owner.id)
  const approved = await systemDb.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })
  check("approvedPayRate snapshotted = 30.00", approved.approvedPayRate?.toFixed(2) === "30.00", String(approved.approvedPayRate))
  check("approvedPayType snapshotted = HOURLY", approved.approvedPayType === "HOURLY")

  console.log("Invoice provides revenue:")
  const inv = await generateInvoice(org.id, { customerId: customer.id, periodStart: "2026-09-01", periodEnd: "2026-09-30" })
  check("invoice created with 1 line @ 200", inv.created === true && (inv.created ? inv.total : "") === "200.00")

  console.log("Per-job profitability:")
  const jp = await getJobProfitability(org.id, job.id)
  check("billed 200.00", jp?.billedAmount.toFixed(2) === "200.00", jp?.billedAmount.toString())
  check("labor 45.00 (1.5h × 30)", jp?.laborCost?.toFixed(2) === "45.00", jp?.laborCost?.toString())
  check("gross margin 155.00", jp?.grossMargin?.toFixed(2) === "155.00", jp?.grossMargin?.toString())
  check("margin % 77.5", jp?.marginPct === 77.5, String(jp?.marginPct))

  console.log("Rolled-up profitability (by site / customer / plan):")
  const prof = await getProfitability(org.id, { periodStart: "2026-09-01", periodEnd: "2026-09-30" })
  check("by site: 1 row, revenue 200, labor 45, jobs 1", prof.bySite.length === 1 && prof.bySite[0].revenue.toFixed(2) === "200.00" && prof.bySite[0].laborCost.toFixed(2) === "45.00" && prof.bySite[0].jobs === 1)
  check("by customer rolled up: margin 155.00", prof.byCustomer[0]?.margin.toFixed(2) === "155.00")
  check("by plan: plan name present, margin 155.00", prof.byPlan[0]?.name === "Nightly" && prof.byPlan[0]?.margin.toFixed(2) === "155.00")
  check("summary margin% 77.5", prof.summary.marginPct === 77.5, String(prof.summary.marginPct))

  console.log("A later raise does NOT rewrite history:")
  await systemDb.employeeProfile.update({ where: { userId: cleaner.id }, data: { payRate: "60.00" } })
  const jp2 = await getJobProfitability(org.id, job.id)
  check("labor still 45.00 after raise to 60 (snapshot preserved)", jp2?.laborCost?.toFixed(2) === "45.00", jp2?.laborCost?.toString())

  console.log("Salaried labor is unavailable, never invented:")
  const salaried = await systemDb.user.create({
    data: {
      organizationId: org.id,
      email: `salary-${stamp}@t.test`,
      name: "Manager on site",
      password: "x",
      role: "CLEANER",
      employeeProfile: { create: { organizationId: org.id, payType: "SALARY", payRate: "60000.00" } },
    },
  })
  const job2 = await systemDb.job.create({
    data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Salaried job", status: "COMPLETED", scheduledStart: new Date("2026-09-11T09:00:00Z"), actualEnd: new Date("2026-09-11T10:00:00Z") },
  })
  const e2 = await systemDb.timeEntry.create({
    data: { organizationId: org.id, userId: salaried.id, jobId: job2.id, status: "COMPLETED", clockInAt: new Date("2026-09-11T09:00:00Z"), clockOutAt: new Date("2026-09-11T10:00:00Z") },
  })
  await approveTimeEntry(org.id, e2.id, owner.id)
  const jpS = await getJobProfitability(org.id, job2.id)
  check("salaried job: labor unavailable (null), flagged salaried", jpS?.laborAvailable === false && jpS?.laborCost === null && jpS?.salaried === true)

  console.log("Uninvoiced job excluded from margin by default; opt-in includes it:")
  const job3 = await systemDb.job.create({
    data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Uninvoiced job", status: "COMPLETED", scheduledStart: new Date("2026-09-12T09:00:00Z"), actualEnd: new Date("2026-09-12T10:00:00Z") },
  })
  const e3 = await systemDb.timeEntry.create({
    data: { organizationId: org.id, userId: cleaner.id, jobId: job3.id, status: "COMPLETED", clockInAt: new Date("2026-09-12T09:00:00Z"), clockOutAt: new Date("2026-09-12T10:00:00Z") },
  })
  await approveTimeEntry(org.id, e3.id, owner.id) // cleaner now $60 → 1h = $60 labor
  const def = await getProfitability(org.id, { periodStart: "2026-09-01", periodEnd: "2026-09-30" })
  check("default: revenue still 200 (uninvoiced not a false loss)", def.summary.revenue.toFixed(2) === "200.00")
  check("default: 1 uninvoiced job, $60 uninvoiced labor surfaced", def.summary.uninvoicedJobs === 1 && def.summary.uninvoicedLabor.toFixed(2) === "60.00")
  check("default: 1 salaried job counted as unavailable", def.summary.unavailableJobs === 1)
  const incl = await getProfitability(org.id, { periodStart: "2026-09-01", periodEnd: "2026-09-30", includeUninvoiced: true })
  check("include: labor 105 (45+60), 2 jobs; salaried still excluded", incl.summary.laborCost.toFixed(2) === "105.00" && incl.summary.jobs === 2 && incl.summary.unavailableJobs === 1)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PROFITABILITY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
