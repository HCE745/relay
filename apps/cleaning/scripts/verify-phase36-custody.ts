// Phase 36 integration verification: key & asset custody tracking.
//  - checkout with a job link; checkout with no job (standing hold); both work
//  - check-in; transfer logs both people in one action; report lost; replace
//    links the new item to the one it replaced (chain intact)
//  - full history per item; outstanding report with how-long-out + holder
//  - current custody at a glance (denormalized holder); per-person held items
//  - offboarding guard blocks deactivating someone still holding items
//  - job detail custody; every movement also writes an AuditEvent
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase36-custody.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import {
  checkoutAccessItem, checkinAccessItem, transferAccessItem, reportAccessItemLost, replaceAccessItem,
  checkoutAsset, listOutstandingCustody, listAccessItemCustody, listUserHeldItems, countUserHeldItems, listJobCustody,
} from "../src/lib/data/custody"
import { updateUser } from "../src/lib/data/users"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }
const aItem = (orgId: string, id: string) => systemDb.accessItem.findFirst({ where: { id }, select: { status: true, holderUserId: true, heldSince: true, replacesId: true } })
const auditCount = (orgId: string, entityId: string) => systemDb.auditEvent.count({ where: { organizationId: orgId, entityId, action: { startsWith: "custody_" } } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Custody Co", slug: `cu-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const alice = await systemDb.user.create({ data: { organizationId: org.id, name: "Alice", email: `a-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const bob = await systemDb.user.create({ data: { organizationId: org.id, name: "Bob", email: `b-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Night clean", status: "SCHEDULED", scheduledStart: new Date(), plannedStart: new Date() }, select: { id: true } })
  const key = await systemDb.accessItem.create({ data: { organizationId: org.id, serviceLocationId: site.id, type: "KEY", identifier: "Front key" }, select: { id: true } })
  const masterKey = await systemDb.accessItem.create({ data: { organizationId: org.id, serviceLocationId: site.id, type: "KEY", identifier: "Master key" }, select: { id: true } })
  const asset = await systemDb.asset.create({ data: { organizationId: org.id, name: "Auto-scrubber", category: "MACHINE", status: "ACTIVE" }, select: { id: true } })

  console.log("Checkout with a job link:")
  await checkoutAccessItem(org.id, key.id, { toUserId: alice.id, jobId: job.id, notes: "for the night clean" }, mgr.id)
  let k = await aItem(org.id, key.id)
  check("held by Alice, status ISSUED, heldSince set", k?.holderUserId === alice.id && k?.status === "ISSUED" && !!k?.heldSince)
  const ev0 = (await listAccessItemCustody(org.id, key.id))[0]
  check("checkout event links the job", ev0?.action === "CHECKED_OUT" && ev0?.job?.id === job.id)
  check("checkout wrote an AuditEvent", (await auditCount(org.id, key.id)) === 1)
  check("cannot check out an item already out", (await threw(() => checkoutAccessItem(org.id, key.id, { toUserId: bob.id }, mgr.id))) !== null)

  console.log("\nCheckout with NO job (standing hold):")
  await checkoutAccessItem(org.id, masterKey.id, { toUserId: alice.id }, mgr.id)
  const mev = (await listAccessItemCustody(org.id, masterKey.id))[0]
  check("standing hold records person + time, no job", mev?.action === "CHECKED_OUT" && mev?.holder != null && mev?.job == null)

  console.log("\nTransfer logs both people in one action:")
  await transferAccessItem(org.id, key.id, bob.id, "shift handoff", mgr.id)
  k = await aItem(org.id, key.id)
  const tev = (await listAccessItemCustody(org.id, key.id))[0]
  check("now held by Bob", k?.holderUserId === bob.id)
  check("one TRANSFERRED event names from Alice and to Bob", tev?.action === "TRANSFERRED" && tev?.fromUser?.name === "Alice" && tev?.holder?.name === "Bob")

  console.log("\nOutstanding report + per-person + at-a-glance:")
  const outstanding = await listOutstandingCustody(org.id)
  check("key + master key both outstanding", outstanding.filter((r) => r.kind === "ACCESS").length === 2)
  check("report carries holder + since (how long out)", outstanding.every((r) => r.holderName && r.since))
  check("Bob currently holds 1 (the transferred key)", (await countUserHeldItems(org.id, bob.id)) === 1)
  const aliceHeld = await listUserHeldItems(org.id, alice.id)
  check("Alice holds the master key (standing)", aliceHeld.accessItems.some((i) => i.label === "Master key"))

  console.log("\nOffboarding guard:")
  check("cannot deactivate Bob while he holds a key", (await threw(() => updateUser(org.id, "OWNER", bob.id, { isActive: false }))) !== null)
  await checkinAccessItem(org.id, key.id, null, mgr.id)
  k = await aItem(org.id, key.id)
  check("check-in clears holder + status RETURNED", k?.holderUserId === null && k?.status === "RETURNED")
  check("Bob can be deactivated once he holds nothing", (await threw(() => updateUser(org.id, "OWNER", bob.id, { isActive: false }))) === null)

  console.log("\nReport lost + replacement chain:")
  await reportAccessItemLost(org.id, masterKey.id, "lost on site", mgr.id)
  check("master key marked LOST, holder cleared", (await aItem(org.id, masterKey.id))?.status === "LOST")
  const recut = await replaceAccessItem(org.id, masterKey.id, { identifier: "Master key v2" }, mgr.id)
  const r = await aItem(org.id, recut.id)
  check("replacement links back to the lost item (chain intact)", r?.replacesId === masterKey.id)
  check("replacement cannot be done twice", (await threw(() => replaceAccessItem(org.id, masterKey.id, { identifier: "x" }, mgr.id))) !== null)

  console.log("\nJob detail custody + asset custody:")
  const jobItems = await listJobCustody(org.id, job.id)
  check("job shows the key checked out for it", jobItems.some((e) => e.accessItem?.id === key.id))
  await checkoutAsset(org.id, asset.id, { toUserId: alice.id }, mgr.id)
  const outWithAsset = await listOutstandingCustody(org.id)
  check("asset appears in the outstanding report", outWithAsset.some((row) => row.kind === "ASSET" && row.holderName === "Alice"))
  check("asset checkout wrote an AuditEvent", (await auditCount(org.id, asset.id)) === 1)

  console.log("\nOffboarding override (OWNER/ADMIN only, reason required):")
  // Alice now holds the asset (checked out above). She "quit" without returning it.
  check("MANAGER cannot override", (await threw(() => updateUser(org.id, "MANAGER", alice.id, { isActive: false, custodyOverride: true, custodyOverrideReason: "quit" }))) !== null)
  check("OWNER override requires a reason", (await threw(() => updateUser(org.id, "OWNER", alice.id, { isActive: false, custodyOverride: true }))) !== null)
  check("still blocked without the override flag", (await threw(() => updateUser(org.id, "OWNER", alice.id, { isActive: false }))) !== null)
  await updateUser(org.id, "OWNER", alice.id, { isActive: false, custodyOverride: true, custodyOverrideReason: "Quit without returning the scrubber" }, mgr.id)
  const alice2 = await systemDb.user.findFirst({ where: { id: alice.id }, select: { isActive: true } })
  check("Alice is now deactivated", alice2?.isActive === false)
  const assetRow = await systemDb.asset.findFirst({ where: { id: asset.id }, select: { custodyUserId: true, custodyNotReturned: true } })
  check("asset flagged unrecovered, still attributed to Alice", assetRow?.custodyNotReturned === true && assetRow?.custodyUserId === alice.id)
  const outFinal = await listOutstandingCustody(org.id)
  check("unrecovered asset stays on the outstanding report, flagged", outFinal.some((r) => r.kind === "ASSET" && r.notReturned === true))
  check("NOT_RETURNED custody event recorded", (await systemDb.custodyEvent.count({ where: { organizationId: org.id, assetId: asset.id, action: "NOT_RETURNED" } })) === 1)
  check("override + reason recorded against the user in AuditEvent", (await systemDb.auditEvent.count({ where: { organizationId: org.id, entityType: "User", entityId: alice.id, action: "custody_offboarding_override" } })) === 1)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL CUSTODY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
