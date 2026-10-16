// Phase 37 integration verification: commission & crew-based pay.
//  - recompute from job completion; snapshot of the rule used
//  - edge cases handled, not guessed: no billable (PENDING), invoiced later
//    (fills in), voided invoice (VOIDED), crew added/removed (rows add/drop)
//  - crew-size band changes the percent; per-person vs split differ
//  - earnings feed profitability labor cost without double counting
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase37-commission.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { recomputeJobEarnings, createPayRule, listJobEarnings, jobCommissionCost } from "../src/lib/data/commission"
import { getJobProfitability } from "../src/lib/data/profitability"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
const earningFor = async (orgId: string, jobId: string, userId: string) =>
  systemDb.jobEarning.findFirst({ where: { jobId, userId }, select: { amount: true, status: true, crewSize: true, percentApplied: true } })

async function completedJob(orgId: string, siteId: string, crew: string[]) {
  return systemDb.job.create({
    data: {
      organizationId: orgId, serviceLocationId: siteId, title: "Night clean", status: "COMPLETED",
      scheduledStart: new Date(), plannedStart: new Date(), actualEnd: new Date(),
      assignments: { create: crew.map((uid) => ({ organizationId: orgId, userId: uid, status: "COMPLETED" })) },
    },
    select: { id: true },
  })
}
async function invoiceJob(orgId: string, customerId: string, jobId: string, amount: string, status: "SENT" | "VOID" = "SENT") {
  const now = new Date()
  return systemDb.invoice.create({
    data: {
      organizationId: orgId, customerId, invoiceNumber: Math.floor(Math.random() * 1e9), status,
      issueDate: now, dueDate: now, periodStart: now, periodEnd: now, currency: "USD", subtotal: amount, taxTotal: "0", total: amount,
      lines: { create: [{ jobId, activeJobId: status === "VOID" ? null : jobId, billable: true, description: "Clean", serviceDate: now, quantity: "1", unitRate: amount, amount }] },
    },
    select: { id: true },
  })
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Commission Co", slug: `cm-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const alice = await systemDb.user.create({ data: { organizationId: org.id, name: "Alice", email: `a-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const bob = await systemDb.user.create({ data: { organizationId: org.id, name: "Bob", email: `b-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  // Role rule: PERCENT, solo 40% / pair 25%, per person.
  await createPayRule(org.id, { userId: null, role: "CLEANER", basis: "PERCENT_OF_JOB_REVENUE", splitMode: "PER_PERSON", soloValue: "40", pairValue: "25", crewValue: "20", customerId: null, serviceLocationId: null, servicePlanId: null })

  console.log("No billable amount yet → PENDING:")
  const job = await completedJob(org.id, site.id, [alice.id])
  await recomputeJobEarnings(org.id, job.id)
  let e = await earningFor(org.id, job.id, alice.id)
  check("solo percent, awaiting invoice → PENDING, amount 0", e?.status === "PENDING" && e?.amount.toString() === "0" && e?.percentApplied?.toString() === "40")

  console.log("\nInvoiced later → fills in (40% of 300 = 120):")
  await invoiceJob(org.id, cust.id, job.id, "300")
  await recomputeJobEarnings(org.id, job.id)
  e = await earningFor(org.id, job.id, alice.id)
  check("CALCULATED 120 at solo band", e?.status === "CALCULATED" && e?.amount.toString() === "120" && e?.crewSize === 1)

  console.log("\nCrew member added after completion → band shifts to pair (25% each = 75):")
  await systemDb.jobAssignment.create({ data: { organizationId: org.id, jobId: job.id, userId: bob.id, status: "COMPLETED" } })
  await recomputeJobEarnings(org.id, job.id)
  const ea = await earningFor(org.id, job.id, alice.id)
  const eb = await earningFor(org.id, job.id, bob.id)
  check("both earn 75 (pair 25% per person), crewSize 2", ea?.amount.toString() === "75" && eb?.amount.toString() === "75" && ea?.crewSize === 2)

  console.log("\nCrew member removed → back to solo; removed member's earning dropped:")
  await systemDb.jobAssignment.deleteMany({ where: { jobId: job.id, userId: bob.id } })
  await recomputeJobEarnings(org.id, job.id)
  check("Alice back to 120 (solo)", (await earningFor(org.id, job.id, alice.id))?.amount.toString() === "120")
  check("Bob's earning removed", (await earningFor(org.id, job.id, bob.id)) === null)

  console.log("\nEarnings feed profitability labor WITHOUT double counting:")
  const prof = await getJobProfitability(org.id, job.id)
  check("job labor cost = the commission (120), no hourly double count", prof?.laborCost?.toString() === "120")
  check("jobCommissionCost helper agrees", (await jobCommissionCost(org.id, job.id)).toString() === "120")

  console.log("\nVoided invoice after earnings calculated → VOIDED:")
  const inv = await systemDb.invoice.findFirstOrThrow({ where: { organizationId: org.id }, select: { id: true } })
  await systemDb.$transaction([
    systemDb.invoice.updateMany({ where: { id: inv.id }, data: { status: "VOID" } }),
    systemDb.invoiceLine.updateMany({ where: { invoiceId: inv.id }, data: { activeJobId: null } }),
  ])
  await recomputeJobEarnings(org.id, job.id)
  check("Alice earning → VOIDED, amount 0", (await earningFor(org.id, job.id, alice.id))?.status === "VOIDED")

  console.log("\nFlat rule needs no billable; split divides it:")
  await systemDb.payRule.deleteMany({ where: { organizationId: org.id } })
  await createPayRule(org.id, { userId: null, role: "CLEANER", basis: "FLAT_PER_JOB", splitMode: "SPLIT_ACROSS_CREW", soloValue: "60", pairValue: "60", crewValue: "60", customerId: null, serviceLocationId: null, servicePlanId: null })
  const flatJob = await completedJob(org.id, site.id, [alice.id, bob.id])
  await recomputeJobEarnings(org.id, flatJob.id)
  const flats = await listJobEarnings(org.id, flatJob.id)
  check("flat 60 split across 2 → 30 each, no invoice needed", flats.length === 2 && flats.every((f) => f.amount.toString() === "30" && f.status === "CALCULATED"))

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL COMMISSION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
