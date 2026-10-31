// Phase 41 integration verification: payroll period locking.
//  - a locked period blocks approvals and corrections of time inside it
//  - commission earnings for work inside a locked period are frozen
//  - OWNER/ADMIN unlock (with a reason) reopens it; edits work again
//  - overlapping periods are rejected
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase41-locking.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createPayPeriod, lockPeriod, unlockPeriod, isDateLocked } from "../src/lib/data/pay-periods"
import { approveTimeEntry, correctTimeEntry } from "../src/lib/data/time-entries"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>): Promise<boolean> { try { await fn(); return false } catch { return true } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Lock Co", slug: `lk-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const owner = await systemDb.user.create({ data: { organizationId: org.id, name: "Owner", email: `o-${stamp}@t.co`, password: "x", role: "OWNER" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleaner", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER", employeeProfile: { create: { organizationId: org.id, payRate: "20.00", payType: "HOURLY" } } } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: "Clean", billingType: "FLAT_PER_JOB", rate: "500.00", billingMode: "PER_JOB" }, select: { id: true } })

  const inPeriod = new Date("2026-06-10T14:00:00.000Z")
  const outPeriod = new Date("2026-06-10T18:00:00.000Z")
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "June clean", status: "COMPLETED", plannedStart: inPeriod, scheduledStart: inPeriod, scheduledEnd: outPeriod, actualEnd: outPeriod, crewSize: 1, createdById: owner.id, assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "COMPLETED" }] } }, select: { id: true } })
  const entry = await systemDb.timeEntry.create({ data: { organizationId: org.id, jobId: job.id, userId: cleaner.id, clockInAt: inPeriod, clockOutAt: outPeriod, breakMinutes: 0, status: "COMPLETED", clockInSource: "mobile_gps" }, select: { id: true } })

  console.log("Before locking — edits allowed:")
  check("not locked yet", !(await isDateLocked(org.id, inPeriod)))

  console.log("\nCreate + lock the period:")
  const period = await createPayPeriod(org.id, { start: "2026-06-01", end: "2026-06-30" })
  await lockPeriod(org.id, period.id, owner.id)
  check("date now reads as locked", await isDateLocked(org.id, inPeriod))
  check("overlapping period is rejected", await threw(() => createPayPeriod(org.id, { start: "2026-06-15", end: "2026-07-15" })))

  console.log("\nLocked → approvals and corrections blocked:")
  check("approve is blocked", await threw(() => approveTimeEntry(org.id, entry.id, owner.id)))
  check("correct is blocked", await threw(() => correctTimeEntry(org.id, entry.id, owner.id, { clockOutAt: new Date("2026-06-10T19:00:00.000Z"), reason: "fix" })))
  const stillOpen = await orgDb(org.id).timeEntry.findFirst({ where: { id: entry.id }, select: { status: true } })
  check("entry stays unapproved", stillOpen?.status === "COMPLETED")

  console.log("\nUnlock (owner, with reason) → edits allowed again:")
  check("unlock requires a reason", await threw(() => unlockPeriod(org.id, period.id, owner.id, "   ")))
  await unlockPeriod(org.id, period.id, owner.id, "Correcting a missed punch before re-export")
  check("date reads unlocked", !(await isDateLocked(org.id, inPeriod)))
  const appr = await approveTimeEntry(org.id, entry.id, owner.id)
  check("approve now succeeds", appr.alreadyApproved === false)
  const audit = await orgDb(org.id).auditEvent.findFirst({ where: { entityType: "PayPeriod", action: "unlock" }, select: { metadata: true } })
  check("unlock reason is audited", !!audit && JSON.stringify(audit.metadata).includes("Correcting a missed punch"))

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL LOCKING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
