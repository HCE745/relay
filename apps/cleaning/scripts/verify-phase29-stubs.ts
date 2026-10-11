// Phase 29 verification: the formerly-dead capabilities now either DO something
// or are gone.
//  - break/meal tracking: a clock-out break is captured on the TimeEntry
//  - geofence enforcement: with the capability + a site geofence, a clock-in
//    outside the radius is blocked; inside is allowed; without the capability or
//    without a captured location it is NOT blocked (never strands bad-GPS crews)
//  - deleted caps are no longer in the catalog
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase29-stubs.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { clockIn, clockOut } from "../src/lib/scheduling/execution"
import { isCapability } from "../src/lib/entitlements/capabilities"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function makeAssignedJob(orgId: string, siteId: string, userId: string) {
  const job = await systemDb.job.create({ data: { organizationId: orgId, serviceLocationId: siteId, title: "Shift", status: "ASSIGNED", scheduledStart: new Date(), plannedStart: new Date(), assignments: { create: [{ organizationId: orgId, userId, status: "ASSIGNED" }] } }, select: { id: true } })
  return job.id
}

async function main() {
  const stamp = Date.now()
  console.log("Deleted capabilities are gone from the catalog:")
  for (const cap of ["operations.correctiveActions", "operations.escalations", "procurement.purchaseOrders", "procurement.inventory"]) {
    check(`${cap} removed`, !isCapability(cap))
  }

  console.log("\nBreak/meal tracking:")
  const org = await systemDb.organization.create({ data: { name: "Stub Co", slug: `st-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleo", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  // Site with NO geofence → break test unaffected by geofencing.
  const plainSite = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Plain", timezone: "UTC" } })
  const bJob = await makeAssignedJob(org.id, plainSite.id, cleaner.id)
  await clockIn(org.id, bJob, cleaner.id, { source: "web" })
  await clockOut(org.id, bJob, cleaner.id, { source: "web", breakMinutes: 30 })
  const entry = await systemDb.timeEntry.findFirstOrThrow({ where: { jobId: bJob, userId: cleaner.id } })
  check("break minutes captured on the time entry", entry.breakMinutes === 30, `break=${entry.breakMinutes}`)

  console.log("\nGeofence enforcement (capability on):")
  const geoSite = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Geo", timezone: "UTC", latitude: 30.0, longitude: -97.0, geofenceRadiusM: 500 } })
  const inJob = await makeAssignedJob(org.id, geoSite.id, cleaner.id)
  // Inside the radius (~15m away) → allowed.
  await clockIn(org.id, inJob, cleaner.id, { lat: 30.0001, lng: -97.0001, accuracyM: 5, source: "web" })
  check("clock-in inside the geofence is allowed", !!(await systemDb.timeEntry.findFirst({ where: { jobId: inJob, status: "OPEN" } })))
  await clockOut(org.id, inJob, cleaner.id, { source: "web" })
  // Outside the radius (~111km away) → blocked.
  const cleaner2 = await systemDb.user.create({ data: { organizationId: org.id, name: "Max", email: `mx-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const outJob = await makeAssignedJob(org.id, geoSite.id, cleaner2.id)
  const blocked = await threw(() => clockIn(org.id, outJob, cleaner2.id, { lat: 31.0, lng: -97.0, accuracyM: 5, source: "web" }))
  check("clock-in outside the geofence is blocked", blocked !== null)
  // No captured location → NOT blocked (best-effort).
  const okNoLoc = await threw(() => clockIn(org.id, outJob, cleaner2.id, { source: "web" }))
  check("clock-in with no GPS fix is allowed (not stranded)", okNoLoc === null)

  console.log("\nGeofence OFF (capability absent) → never blocks:")
  const solo = await systemDb.organization.create({ data: { name: "Solo Co", slug: `so-${stamp}`, packageTier: "SOLO", timezone: "UTC" } })
  const sc = await systemDb.user.create({ data: { organizationId: solo.id, name: "Sal", email: `s-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const scust = await systemDb.customer.create({ data: { organizationId: solo.id, name: "SoloCust" } })
  const sSite = await systemDb.serviceLocation.create({ data: { organizationId: solo.id, customerId: scust.id, name: "Geo", timezone: "UTC", latitude: 30.0, longitude: -97.0, geofenceRadiusM: 500 } })
  const sJob = await makeAssignedJob(solo.id, sSite.id, sc.id)
  const okNoCap = await threw(() => clockIn(solo.id, sJob, sc.id, { lat: 31.0, lng: -97.0, source: "web" }))
  check("far clock-in allowed when geofencing capability is absent", okNoCap === null)

  await systemDb.organization.delete({ where: { id: org.id } })
  await systemDb.organization.delete({ where: { id: solo.id } })
  console.log(`\n${failures === 0 ? "ALL STUB-CLEANUP CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
