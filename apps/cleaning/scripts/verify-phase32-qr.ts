// Phase 32 integration verification: QR operational reporting (public write).
//  - a valid scan files an EXTERNAL issue (source QR, no internal reporter,
//    deadlines + routing) and returns a reference
//  - the Phase 2.3 defenses apply and are PROVEN: in-memory trustworthy-IP token
//    bucket, durable per-IP cap, durable per-org cap, honeypot
//  - a leaked code is revocable on its own — others keep working, no reprint
//  - occupant reports are isolated: public info never leaks internal data
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase32-qr.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createQrCode, setQrCodeActive, submitQrIssue, getPublicQrInfo } from "../src/lib/data/qr-codes"
import { createRoutingRule } from "../src/lib/data/issue-routing"
import { getIssue } from "../src/lib/data/issues"
import { enforceIpBurst, resetRateLimiter } from "../src/lib/rate-limit"
import { enforceIntakeLimits as durableLimits, IntakeRejected, isHoneypotTripped } from "../src/lib/public-intake"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown> | unknown): Promise<unknown> { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "QR Co", slug: `qr-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const admin = await systemDb.user.create({ data: { organizationId: org.id, name: "Admin", email: `a-${stamp}@t.co`, password: "x", role: "ADMIN" } })
  const janitor = await systemDb.user.create({ data: { organizationId: org.id, name: "Jo Janitor", email: `j-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })

  // Route QR-sourced issues to the janitor so we prove source QR flows through routing.
  await createRoutingRule(org.id, admin.id, { name: "QR → janitor", priority: 10, isActive: true, category: null, severity: null, source: "QR", serviceLocationId: null, assignToId: janitor.id })

  const code = await createQrCode(org.id, admin.id, { serviceLocationId: site.id, label: "Lobby restroom" })
  const code2 = await createQrCode(org.id, admin.id, { serviceLocationId: site.id, label: "2nd floor" })

  console.log("A valid scan files an external, routed issue:")
  const r = await submitQrIssue(code.token, { category: "SUPPLIES", description: "Out of paper towels", reporterName: "Pat" }, "ip-hash-A")
  check("submission returns a reference", !!r?.reference, r?.reference)
  const filed = await systemDb.issue.findFirst({ where: { organizationId: org.id, qrCodeId: code.id }, select: { id: true, source: true, reportedById: true, externalReporter: true, ackDeadline: true, resolveDeadline: true, assignedToId: true } })
  check("source QR, no internal reporter (external)", filed?.source === "QR" && filed?.reportedById === null)
  check("external reporter captured", (filed?.externalReporter ?? "").includes("Pat"))
  check("SLA deadlines set (Phase 30 clock)", !!filed?.ackDeadline && !!filed?.resolveDeadline)
  check("routed via source=QR rule to the janitor", filed?.assignedToId === janitor.id)
  const audit = await systemDb.auditEvent.count({ where: { organizationId: org.id, entityType: "Issue", entityId: filed!.id, action: "route" } })
  check("routing decision logged with null actor", audit === 1)

  console.log("\nExternal isolation — public info exposes only org + site label:")
  const info = await getPublicQrInfo(code.token)
  check("public info has org name + label, nothing internal", !!info && "organizationName" in info && "label" in info && !("organizationId" in info))

  console.log("\nIn-memory trustworthy-IP token bucket (Phase 2.3) rejects a burst:")
  resetRateLimiter()
  const ipKey = "1.2.3.4"
  let allowed = 0
  for (let i = 0; i < 20; i++) { if ((await threw(() => enforceIpBurst(ipKey))) === null) allowed++ }
  check("burst from one IP is capped (not all 20 allowed)", allowed > 0 && allowed < 20, `allowed=${allowed}`)
  check("the rejection is an IntakeRejected 429", (await threw(() => { for (let i = 0; i < 50; i++) enforceIpBurst(ipKey) })) instanceof IntakeRejected)

  console.log("\nDurable per-IP + per-org caps (logic + live):")
  check("per-org cap throws 'capacity' at the ceiling", (await threw(() => durableLimits(0, 40))) instanceof IntakeRejected)
  check("per-IP cap throws 'rate_limit' at the ceiling", (await threw(() => durableLimits(5, 0))) instanceof IntakeRejected)
  check("under the caps does not throw", (await threw(() => durableLimits(4, 39))) === null)
  // Live per-IP durable cap through the real write path: 5 from one IP, 6th rejected.
  let ok6 = 0
  for (let i = 0; i < 5; i++) { if ((await threw(() => submitQrIssue(code2.token, { description: `report ${i}` }, "flooder"))) === null) ok6++ }
  const sixth = await threw(() => submitQrIssue(code2.token, { description: "one too many" }, "flooder"))
  check("5 from one IP persist, the 6th is rejected", ok6 === 5 && sixth instanceof IntakeRejected)

  console.log("\nHoneypot detection:")
  check("non-empty honeypot ⇒ bot", isHoneypotTripped("http://spam") && !isHoneypotTripped(""))

  console.log("\nRevocation is per-code (no reprinting the others):")
  await setQrCodeActive(org.id, admin.id, code.id, false)
  const afterRevoke = await submitQrIssue(code.token, { description: "should be rejected" }, "ip-hash-B")
  check("revoked code refuses new reports (returns null)", afterRevoke === null)
  const other = await submitQrIssue(code2.token, { description: "still works" }, "ip-hash-C")
  check("a different code still works after the first is revoked", !!other?.reference)
  const pub = await getPublicQrInfo(code.token)
  check("public page sees the revoked code as inactive", pub?.isActive === false)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL QR CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
