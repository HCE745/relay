// Phase 25 integration verification: push alerts for operational exceptions.
//  - uncovered shift, missed clock-in, and expiring credential are each detected
//    and alerted ONCE (ExceptionAlert dedupe); a second run re-detects but does
//    not re-notify
//  - alerts route through the notification system (NotificationLog rows written;
//    here email/SMS are unconfigured so they log SKIPPED — proving clean degrade)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase25-alerts.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { runExceptionAlerts } from "../src/lib/data/exceptions"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Alert Co", slug: `al-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  await systemDb.user.create({ data: { organizationId: org.id, name: "Owner", email: `o-${stamp}@t.co`, password: "x", role: "OWNER" } })
  const sup = await systemDb.user.create({ data: { organizationId: org.id, name: "Sup", email: `s-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleo", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const now = new Date()

  // Missed clock-in: a job 1h past start, assigned, nobody clocked in.
  const missedJob = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Nightly HQ", status: "ASSIGNED", scheduledStart: new Date(now.getTime() - 3600_000), plannedStart: new Date(now.getTime() - 3600_000), assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "ASSIGNED" }] } }, select: { id: true } })

  // Uncovered shift: a job in 2h, assigned to a cleaner who is unavailable.
  const uncJob = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Morning HQ", status: "ASSIGNED", scheduledStart: new Date(now.getTime() + 2 * 3600_000), plannedStart: new Date(now.getTime() + 2 * 3600_000), assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "ASSIGNED" }] } }, select: { id: true } })
  await systemDb.availability.create({ data: { organizationId: org.id, userId: cleaner.id, startDate: new Date(now.getTime() - 3600_000), endDate: new Date(now.getTime() + 2 * 86_400_000), reason: "Out sick", source: "MANAGER" } })

  // Expiring credential (within 30d default).
  const cred = await systemDb.credential.create({ data: { organizationId: org.id, userId: cleaner.id, type: "CERTIFICATION", status: "ACTIVE", expiryDate: new Date(now.getTime() + 10 * 86_400_000) }, select: { id: true } })

  console.log("First run detects + alerts once each:")
  const r1 = await runExceptionAlerts(org.id, now)
  check("missed clock-in detected", r1.missed === 1, `missed=${r1.missed}`)
  check("uncovered shift detected", r1.uncovered === 1, `uncovered=${r1.uncovered}`)
  check("expiring credential detected", r1.credentials === 1, `credentials=${r1.credentials}`)
  check("one claim per exception", (await systemDb.idempotencyClaim.count({ where: { organizationId: org.id } })) === 3)

  const missedAlertUsers = await systemDb.notificationLog.count({ where: { organizationId: org.id, event: "MISSED_CLOCK_IN" } })
  check("missed clock-in alerted supervisor + managers (owner+sup ≥ 2 logs)", missedAlertUsers >= 2, `logs=${missedAlertUsers}`)
  check("notifications logged (degrade: unconfigured → SKIPPED)", (await systemDb.notificationLog.count({ where: { organizationId: org.id, status: "SKIPPED" } })) > 0)
  void sup; void missedJob; void uncJob; void cred

  console.log("\nSecond run re-detects but does NOT re-alert:")
  const logsBefore = await systemDb.notificationLog.count({ where: { organizationId: org.id } })
  const r2 = await runExceptionAlerts(org.id, now)
  check("no new alerts on the second run", r2.missed === 0 && r2.uncovered === 0 && r2.credentials === 0)
  check("no new notification logs", (await systemDb.notificationLog.count({ where: { organizationId: org.id } })) === logsBefore)
  check("still exactly 3 claim rows", (await systemDb.idempotencyClaim.count({ where: { organizationId: org.id } })) === 3)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL ALERT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
