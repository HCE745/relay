// Phase 14 integration verification. Focus: access codes are stored ENCRYPTED
// (never plaintext), are not returned in lists, and are revealed only via the
// explicit action — which is audited; custody (issue/return/lost) updates the
// holder and logs every transfer to AuditEvent.
//
// Usage: ACCESS_ENCRYPTION_KEY=... DATABASE_URL=... tsx scripts/verify-phase14-access.ts

import { systemDb } from "../src/lib/org-db"
import { createAccessItem, listAccessItems, issueAccessItem, returnAccessItem, markAccessItemLost, revealAccessSecret } from "../src/lib/data/access"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Access Test", slug: `acc-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Tower" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Lobby", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const al = await systemDb.user.create({ data: { organizationId: org.id, name: "Al", email: `a-${stamp}@t.co`, password: "x", role: "CLEANER" } })

  console.log("Codes are stored encrypted, never in plaintext:")
  const code = await createAccessItem(org.id, { serviceLocationId: site.id, type: "ALARM_CODE", identifier: "Alarm panel", secret: "4729#" })
  const key = await createAccessItem(org.id, { serviceLocationId: site.id, type: "KEY", identifier: "Front door key" })
  const row = await systemDb.accessItem.findUniqueOrThrow({ where: { id: code.id } })
  check("ciphertext is stored (not the plaintext)", !!row.secretCiphertext && !row.secretCiphertext.includes("4729#"), row.secretCiphertext?.slice(0, 10))
  check("ciphertext is the versioned GCM blob", row.secretCiphertext!.startsWith("v1:"))

  console.log("Secrets are never returned in lists:")
  const items = await listAccessItems(org.id)
  const listed = items.find((i) => i.id === code.id)!
  check("list row exposes hasSecret, not the code", listed.hasSecret === true && !("secretCiphertext" in listed) && !JSON.stringify(items).includes("4729#"))

  console.log("Reveal returns the code and is audited:")
  const r = await revealAccessSecret(org.id, code.id, mgr.id)
  check("reveal returns the decrypted code", r?.secret === "4729#", r?.secret)
  const revealAudit = await systemDb.auditEvent.findFirst({ where: { organizationId: org.id, entityType: "AccessItem", entityId: code.id, action: "reveal" } })
  check("reveal is logged to AuditEvent with the actor", !!revealAudit && revealAudit.actorUserId === mgr.id)

  console.log("Custody: issue → return → lost, each audited:")
  await issueAccessItem(org.id, key.id, al.id, mgr.id)
  let k = await systemDb.accessItem.findUniqueOrThrow({ where: { id: key.id } })
  check("issue sets holder + ISSUED", k.holderUserId === al.id && k.status === "ISSUED")
  check("issue audited (newValue = holder)", !!(await systemDb.auditEvent.findFirst({ where: { entityId: key.id, action: "issue", newValue: al.id } })))

  await returnAccessItem(org.id, key.id, mgr.id)
  k = await systemDb.accessItem.findUniqueOrThrow({ where: { id: key.id } })
  check("return clears holder + RETURNED", k.holderUserId === null && k.status === "RETURNED")
  check("return audited (oldValue = prior holder)", !!(await systemDb.auditEvent.findFirst({ where: { entityId: key.id, action: "return", oldValue: al.id } })))

  await markAccessItemLost(org.id, key.id, mgr.id)
  k = await systemDb.accessItem.findUniqueOrThrow({ where: { id: key.id } })
  check("mark lost sets LOST", k.status === "LOST")
  check("lost audited", !!(await systemDb.auditEvent.findFirst({ where: { entityId: key.id, action: "lost" } })))

  console.log("A non-secret item has no code to reveal:")
  const err = await revealAccessSecret(org.id, key.id, mgr.id).then(() => null).catch((e) => (e as Error).message)
  check("revealing a key with no code is refused", err !== null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL ACCESS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
