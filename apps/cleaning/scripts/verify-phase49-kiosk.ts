// Phase 49 integration verification: shared time-clock kiosk.
//  - a kiosk authenticates by its device token (wrong/absent token rejected)
//  - a PIN-required kiosk rejects a wrong PIN and an employee with no PIN
//  - a valid punch clocks the employee IN through the normal path (source
//    "kiosk"), creating a per-USER TimeEntry, and writes an AuditEvent
//  - a second punch clocks the same employee OUT (toggle)
//  - the punch is attributed to the right user (per-user integrity intact)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase49-kiosk.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import { createKiosk, setClockPin, authenticateKiosk, kioskPunch, kioskRoster } from "../src/lib/data/kiosks"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const d = await createDemoOrg("49.49.49.49", 2)
  const orgId = d.orgId

  // Deterministic setup: a cleaner with a job at a site scheduled for NOW, so a
  // kiosk at that site resolves the punch. (No geofence coords, so the clock
  // path is not blocked on location.)
  const now = new Date()
  const userId = (await orgDb(orgId).user.findFirstOrThrow({ where: { role: "CLEANER" }, select: { id: true } })).id
  const siteRow = await orgDb(orgId).serviceLocation.findFirstOrThrow({ select: { id: true } })
  const siteId = siteRow.id
  const job = await systemDb.job.create({
    data: {
      organizationId: orgId, serviceLocationId: siteId, title: "Kiosk punch test",
      status: "ASSIGNED", scheduledStart: now, scheduledEnd: new Date(now.getTime() + 3 * 3600_000),
      assignments: { create: { organizationId: orgId, userId, status: "ASSIGNED" } },
    },
    select: { id: true },
  })

  console.log("Kiosk creation + device-token authentication:")
  const made = await createKiosk(orgId, { name: "Test kiosk", serviceLocationId: siteId, pinRequired: true, photoRequired: false })
  check("creation returns a one-time token", !!made.token && made.token.length > 10)
  check("wrong token is rejected", (await authenticateKiosk(made.id, "not-the-token")) === null)
  check("absent token is rejected", (await authenticateKiosk(made.id, "")) === null)
  const kiosk = await authenticateKiosk(made.id, made.token)
  check("correct token authenticates and carries the org", !!kiosk && kiosk.organizationId === orgId)

  console.log("\nPIN gating:")
  const noPin = await threw(() => kioskPunch(kiosk!, { userId }))
  check("punch blocked when the employee has no PIN", noPin !== null)
  await setClockPin(orgId, userId, "4242")
  const wrongPin = await threw(() => kioskPunch(kiosk!, { userId, pin: "0000" }))
  check("punch blocked on a wrong PIN", wrongPin !== null)

  console.log("\nA valid punch clocks IN through the normal path (per-user entry + audit):")
  const openBefore = await orgDb(orgId).timeEntry.count({ where: { userId, status: "OPEN" } })
  if (siteId) {
    const inRes = await kioskPunch(kiosk!, { userId, pin: "4242" })
    check("punch reports a clock-IN", inRes.action === "in", `action=${inRes.action}`)
    const entry = await orgDb(orgId).timeEntry.findFirst({ where: { userId, status: "OPEN" }, select: { clockInSource: true, userId: true } })
    check("a per-user OPEN entry was created", !!entry && entry.userId === userId)
    check('the entry source is "kiosk"', entry?.clockInSource === "kiosk")
    const audit = await orgDb(orgId).auditEvent.findFirst({ where: { actorUserId: userId, action: "kiosk_clock_in" }, select: { metadata: true } })
    check("an audit event records the kiosk punch", !!audit)
    check("the audit names the kiosk", !!audit && JSON.stringify(audit.metadata).includes(made.id))

    console.log("\nA second punch toggles to clock OUT:")
    const outRes = await kioskPunch(kiosk!, { userId, pin: "4242" })
    check("punch reports a clock-OUT", outRes.action === "out", `action=${outRes.action}`)
    const stillOpen = await orgDb(orgId).timeEntry.count({ where: { userId, status: "OPEN" } })
    check("no open entry remains for the user", stillOpen === openBefore)
  } else {
    console.log("  (no site job in window — punch toggle not exercised, auth + PIN gates proven above)")
  }

  console.log("\nRoster reflects PIN + clocked-in state:")
  const roster = await kioskRoster(kiosk!)
  check("roster includes field staff with hasPin flags", roster.length > 0 && roster.some((r) => r.hasPin))

  await systemDb.organization.delete({ where: { id: orgId } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL KIOSK CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
