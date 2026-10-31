// Phase 43 integration verification: shift differentials & labor burden.
//  - approving time snapshots the differential premium for in-window hours
//  - the premium flows into labor cost and the payroll export (distinct column)
//  - labor burden loads onto labor cost in profitability (unburdened kept visible)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase43-differentials.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { approveTimeEntry } from "../src/lib/data/time-entries"
import { createDifferentialRule } from "../src/lib/data/shift-differentials"
import { getJobProfitability } from "../src/lib/data/profitability"
import { buildExport } from "../src/lib/data/exports"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Diff Co", slug: `df-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC", laborBurdenPct: "0.2500" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Nora Night", email: `n-${stamp}@t.co`, password: "x", role: "CLEANER", employeeProfile: { create: { organizationId: org.id, payRate: "20.00", payType: "HOURLY" } } } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" }, select: { id: true } })

  await createDifferentialRule(org.id, { name: "Night differential", startTime: "22:00", endTime: "06:00", daysOfWeek: [], amountType: "PERCENT", value: "10" })

  const inAt = new Date("2026-06-01T20:00:00.000Z")
  const outAt = new Date("2026-06-02T02:00:00.000Z") // 6h, 4h of it in the 22:00–06:00 window
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Night clean", status: "COMPLETED", plannedStart: inAt, scheduledStart: inAt, scheduledEnd: outAt, actualEnd: outAt, crewSize: 1, createdById: cleaner.id, assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "COMPLETED" }] } }, select: { id: true } })
  const entry = await systemDb.timeEntry.create({ data: { organizationId: org.id, jobId: job.id, userId: cleaner.id, clockInAt: inAt, clockOutAt: outAt, breakMinutes: 0, status: "COMPLETED", clockInSource: "mobile_gps" }, select: { id: true } })

  console.log("Approval snapshots the differential:")
  await approveTimeEntry(org.id, entry.id, cleaner.id)
  const approved = await orgDb(org.id).timeEntry.findFirst({ where: { id: entry.id }, select: { approvedDifferential: true, approvedDifferentialNote: true } })
  check("differential snapshotted = 4h × $20 × 10% = 8.00", approved?.approvedDifferential?.toFixed(2) === "8.00")
  check("note names the rule", !!approved?.approvedDifferentialNote?.includes("Night differential"))

  console.log("\nLabor cost = (base + differential) × (1 + burden):")
  const prof = await getJobProfitability(org.id, job.id)
  // base 6h × $20 = 120 + 8 differential = 128; burdened ×1.25 = 160.
  check("unburdened labor = 128.00", prof?.laborCostUnburdened?.toFixed(2) === "128.00")
  check("burdened labor = 160.00", prof?.laborCost?.toFixed(2) === "160.00")
  check("burden pct surfaced", prof?.laborBurdenPct === 0.25)

  console.log("\nPayroll export carries a distinct differential column:")
  const csv = (await buildExport(org.id, "PAYROLL_EARNINGS", { periodStart: "2026-06-01", periodEnd: "2026-06-02" })).csv
  check("header has Shift Differential", csv.includes("Shift Differential"))
  check("Nora's row shows 8.00 differential", csv.split("\n").some((l) => l.includes("Nora Night") && l.includes("8.00")))

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL DIFFERENTIAL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
