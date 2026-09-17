// Phase 2 billing integration verification against a live database. Exercises
// the real invoice data layer end-to-end: FLAT + HOURLY generation, exclusions
// (unapproved time / no rate), idempotency, void-releases-jobs, payments +
// auto-PAID, and AR aging.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase2-billing.ts   (after migrate)

import { systemDb } from "../src/lib/org-db"
import {
  generateInvoice,
  getInvoice,
  setInvoiceStatus,
  addInvoicePayment,
  getArAging,
  getCustomerBilling,
} from "../src/lib/data/invoices"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function expectThrows(name: string, fn: () => Promise<unknown>) {
  let threw = false
  try {
    await fn()
  } catch {
    threw = true
  }
  check(name, threw, threw ? "" : "did not throw")
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({
    data: { name: "Billing Test", slug: `billing-${stamp}`, packageTier: "TEAM", timezone: "UTC" },
  })
  const user = await systemDb.user.create({
    data: { organizationId: org.id, email: `cleaner-${stamp}@t.test`, name: "Cleaner", password: "x", role: "CLEANER" },
  })
  const customer = await systemDb.customer.create({
    data: { organizationId: org.id, name: "Acme Offices", paymentTerms: "NET_15" },
  })
  const site = await systemDb.serviceLocation.create({
    data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" },
  })
  const flat = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Flat", billingType: "FLAT_PER_JOB", rate: "100.00" },
  })
  const hourly = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Hourly", billingType: "HOURLY", rate: "50.00" },
  })
  const noRate = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "NoRate", billingType: "FLAT_PER_JOB" },
  })

  const mkJob = (plan: { id: string }, title: string, day: number) =>
    systemDb.job.create({
      data: {
        organizationId: org.id,
        serviceLocationId: site.id,
        servicePlanId: plan.id,
        title,
        status: "COMPLETED",
        scheduledStart: new Date(`2026-09-${String(day).padStart(2, "0")}T09:00:00Z`),
        actualEnd: new Date(`2026-09-${String(day).padStart(2, "0")}T11:00:00Z`),
      },
    })

  const jobA = await mkJob(flat, "Flat job A", 10)
  const jobB = await mkJob(hourly, "Hourly job B", 11)
  const jobC = await mkJob(hourly, "Hourly job C (unapproved)", 12)
  const jobD = await mkJob(noRate, "No-rate job D", 13)

  // Job B: 90 min APPROVED → 1.5h. Job C: unapproved (COMPLETED status).
  await systemDb.timeEntry.create({
    data: { organizationId: org.id, userId: user.id, jobId: jobB.id, status: "APPROVED", clockInAt: new Date("2026-09-11T09:00:00Z"), clockOutAt: new Date("2026-09-11T10:30:00Z") },
  })
  await systemDb.timeEntry.create({
    data: { organizationId: org.id, userId: user.id, jobId: jobC.id, status: "COMPLETED", clockInAt: new Date("2026-09-12T09:00:00Z"), clockOutAt: new Date("2026-09-12T11:00:00Z") },
  })

  const period = { customerId: customer.id, periodStart: "2026-09-01", periodEnd: "2026-09-30" }

  console.log("Generation — FLAT + HOURLY, with exclusions:")
  const r1 = await generateInvoice(org.id, period)
  check("invoice created", r1.created === true)
  if (r1.created) {
    check("2 billable lines (flat + hourly)", r1.lineCount === 2, `got ${r1.lineCount}`)
    check("total = 100 + 75 = 175.00", r1.total === "175.00", `got ${r1.total}`)
  }
  check("2 jobs excluded (unapproved + no rate)", r1.excluded.length === 2, `got ${r1.excluded.length}`)
  check("job C excluded for unapproved time", r1.excluded.some((x) => x.jobId === jobC.id && /unapproved/i.test(x.reason)))
  check("job D excluded for no rate", r1.excluded.some((x) => x.jobId === jobD.id && /rate/i.test(x.reason)))

  const invoiceId = r1.created ? r1.invoiceId : ""
  const inv = await getInvoice(org.id, invoiceId)
  const flatLine = inv?.lines.find((l) => l.jobId === jobA.id)
  const hourlyLine = inv?.lines.find((l) => l.jobId === jobB.id)
  check("flat line amount 100.00", flatLine?.amount.toFixed(2) === "100.00", flatLine?.amount.toString())
  check("hourly line qty 1.50 @ 50 = 75.00", hourlyLine?.quantity.toFixed(2) === "1.50" && hourlyLine?.amount.toFixed(2) === "75.00", `${hourlyLine?.quantity} × ${hourlyLine?.unitRate}`)
  check("subtotal 175.00, tax 0, total 175.00", inv?.subtotal.toFixed(2) === "175.00" && inv?.taxTotal.toFixed(2) === "0.00" && inv?.total.toFixed(2) === "175.00")
  // NET_15 → due 15 days after issue.
  const dueDelta = inv ? Math.round((inv.dueDate.getTime() - inv.issueDate.getTime()) / 86_400_000) : 0
  check("due date honors NET_15 terms", dueDelta === 15, `${dueDelta} days`)

  console.log("Idempotency — re-running bills nothing new:")
  const r2 = await generateInvoice(org.id, period)
  check("second run creates no invoice", r2.created === false)

  console.log("Void releases jobs back to billable:")
  await setInvoiceStatus(org.id, invoiceId, "VOID")
  const r3 = await generateInvoice(org.id, period)
  check("after void, the 2 jobs are billable again", r3.created === true && (r3.created ? r3.lineCount : 0) === 2)
  const invoice3 = r3.created ? r3.invoiceId : ""

  console.log("Payments + auto-PAID + AR aging:")
  await setInvoiceStatus(org.id, invoice3, "SENT")
  await addInvoicePayment(org.id, invoice3, { amount: "75.00" })
  const aging = await getArAging(org.id)
  check("aging shows one customer with 100.00 outstanding", aging.rows.length === 1 && aging.totals.total.toFixed(2) === "100.00", aging.totals.total.toString())
  const afterFull = await addInvoicePayment(org.id, invoice3, { amount: "100.00" })
  check("invoice auto-marked PAID once covered", afterFull?.status === "PAID", afterFull?.status)
  const agingAfter = await getArAging(org.id)
  check("aging empty once paid", agingAfter.rows.length === 0)

  const billing = await getCustomerBilling(org.id, customer.id)
  check("customer outstanding back to 0", billing.outstanding.toFixed(2) === "0.00", billing.outstanding.toString())

  console.log("Invalid transitions are rejected:")
  await expectThrows("cannot move VOID → SENT", () => setInvoiceStatus(org.id, invoiceId, "SENT"))

  // Cleanup this test org.
  await systemDb.organization.delete({ where: { id: org.id } })

  console.log(`\n${failures === 0 ? "ALL BILLING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
