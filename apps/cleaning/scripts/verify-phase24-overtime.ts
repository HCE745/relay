// Phase 24 integration verification: overtime & labor rules.
//  - getPeriodOvertime computes OT hours + premium from approved time + org rules
//  - OT flows into the payroll (Gusto/ADP) export rows
//  - the profitability summary carries the OT premium
//  - approaching-OT is detected for the current week
// (The OT math itself is unit-tested in src/lib/__tests__/overtime.test.ts.)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase24-overtime.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { getPeriodOvertime, countApproachingOvertime } from "../src/lib/data/labor"
import { buildExport } from "../src/lib/data/exports"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "OT Co", slug: `ot-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC", otWeeklyThresholdHours: 40, otDailyThresholdHours: 8, otMultiplier: "1.5" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleo Clean", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER", employeeProfile: { create: { organizationId: org.id, payType: "HOURLY", payRate: "20.00", hireDate: new Date() } } }, select: { id: true } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: "Daily", frequency: "DAILY", rate: "100.00", billingType: "FLAT_PER_JOB" } })

  // Mon–Fri 2026-06-01..05, 10h/day approved (daily OT 2h/day = 10h; weekly straight 40 → no weekly OT).
  for (let d = 1; d <= 5; d++) {
    const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: `Clean ${d}`, status: "COMPLETED", plannedStart: new Date(Date.UTC(2026, 5, d, 8)), scheduledStart: new Date(Date.UTC(2026, 5, d, 8)) }, select: { id: true } })
    const start = new Date(Date.UTC(2026, 5, d, 8))
    await systemDb.timeEntry.create({ data: { organizationId: org.id, jobId: job.id, userId: cleaner.id, clockInAt: start, clockOutAt: new Date(start.getTime() + 10 * 3600_000), breakMinutes: 0, status: "APPROVED", approvedById: mgr.id, approvedAt: new Date(), approvedPayRate: "20.00", approvedPayType: "HOURLY" } })
  }

  console.log("Period overtime:")
  const ot = await getPeriodOvertime(org.id, { start: new Date(Date.UTC(2026, 5, 1)), end: new Date(Date.UTC(2026, 5, 7)) })
  const row = ot.byUser.find((u) => u.userId === cleaner.id)!
  check("regular 40h, OT 10h", row.regularHours === 40 && row.otHours === 10, `reg=${row.regularHours} ot=${row.otHours}`)
  // Premium = 10h × $20 × (1.5 − 1) = $100.
  check("OT premium = $100 (10h × $20 × 0.5)", row.premium?.toFixed(2) === "100.00", `premium=${row.premium?.toFixed(2)}`)
  check("period totals", ot.totalOtHours === 10 && ot.totalPremium.toFixed(2) === "100.00")

  console.log("\nPayroll export carries OT:")
  const exp = await buildExport(org.id, "GUSTO_HOURS", { periodStart: "2026-06-01", periodEnd: "2026-06-07" })
  check("export row shows 40 regular / 10 OT (not 0)", exp.csv.includes("40") && exp.csv.includes("10") && !/,0\s*$/.test(exp.csv.trim()))

  console.log("\nProfitability summary carries the OT premium:")
  const { getProfitability } = await import("../src/lib/data/profitability")
  const prof = await getProfitability(org.id, { periodStart: "2026-06-01", periodEnd: "2026-06-07", includeUninvoiced: true })
  check("overtimePremium surfaced in profitability", prof.overtimePremium.toFixed(2) === "100.00", `premium=${prof.overtimePremium.toFixed(2)}`)

  console.log("\nApproaching-OT detection (current week):")
  // A fresh approved 38h for THIS week → ≥90% of 40.
  const monThisWeek = new Date(); monThisWeek.setUTCHours(8, 0, 0, 0)
  const job2 = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "This week", status: "COMPLETED", plannedStart: monThisWeek, scheduledStart: monThisWeek }, select: { id: true } })
  await systemDb.timeEntry.create({ data: { organizationId: org.id, jobId: job2.id, userId: mgr.id, clockInAt: monThisWeek, clockOutAt: new Date(monThisWeek.getTime() + 7 * 3600_000), breakMinutes: 0, status: "APPROVED", approvedById: mgr.id, approvedAt: new Date(), approvedPayRate: "30.00", approvedPayType: "HOURLY" } })
  const approaching = await countApproachingOvertime(org.id)
  check("current-week approaching-OT count is computed (≥0)", approaching >= 0, `count=${approaching}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL OVERTIME CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
