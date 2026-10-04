// Phase 13 integration verification. Focus: credential expiry states drive the
// dashboard alert count; a site's credential requirements gate assignment —
// WARN by default, BLOCK when the org opts in; and a valid credential clears it.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase13-compliance.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createCredential, setSiteRequirements, countCredentialAlerts } from "../src/lib/data/credentials"
import { checkAssignmentCompliance } from "../src/lib/data/compliance"
import { assignCleaner } from "../src/lib/data/assignments"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) {
  try { await fn(); return null } catch (e) { return (e as Error).message }
}
const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Compliance Test", slug: `cmp-${stamp}`, packageTier: "BUSINESS", timezone: "UTC", credentialExpiryLeadDays: 30 } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Bank" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Vault", timezone: "UTC" } })
  const al = await systemDb.user.create({ data: { organizationId: org.id, name: "Al", email: `al-${stamp}@t.co`, password: "x", role: "CLEANER" } })

  const mkJob = () => systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Clean", status: "SCHEDULED", scheduledStart: new Date(Date.now() + 86_400_000) } })

  console.log("Expiry states drive the dashboard alert count:")
  await createCredential(org.id, { userId: al.id, type: "INSURANCE", expiryDate: soon }) // expiring within 30d
  await createCredential(org.id, { userId: al.id, type: "BONDING", expiryDate: past }) // expired
  await createCredential(org.id, { userId: al.id, type: "TRAINING", expiryDate: future }) // fine
  const alerts = await countCredentialAlerts(org.id, 30)
  check("expiring + expired both counted, not the healthy one", alerts === 2, `alerts=${alerts}`)

  console.log("Site requires a credential the cleaner lacks:")
  await setSiteRequirements(org.id, site.id, ["BACKGROUND_CHECK"])
  const c1 = await checkAssignmentCompliance(org.id, al.id, site.id)
  check("compliance reports the missing requirement", !c1.ok && c1.unmet.some((u) => u.type === "BACKGROUND_CHECK" && u.reason === "missing"))

  console.log("Warn by default — assignment still succeeds, with a warning:")
  const job1 = await mkJob()
  const r1 = await assignCleaner(org.id, job1.id, al.id)
  check("assignment succeeds when org is in warn mode", r1.assigned)
  check("a credential warning is surfaced", r1.credentialWarnings.length > 0, r1.credentialWarnings.join("; "))

  console.log("Block mode — assignment is refused:")
  await systemDb.organization.update({ where: { id: org.id }, data: { blockAssignmentOnExpiredCredential: true } })
  const job2 = await mkJob()
  const err = await threw(() => assignCleaner(org.id, job2.id, al.id))
  check("assignment is blocked", err !== null && /credential/i.test(err ?? ""))
  const assignedCount = await systemDb.jobAssignment.count({ where: { jobId: job2.id } })
  check("no assignment row was created when blocked", assignedCount === 0)

  console.log("A valid credential clears the requirement:")
  await createCredential(org.id, { userId: al.id, type: "BACKGROUND_CHECK", expiryDate: future })
  const c2 = await checkAssignmentCompliance(org.id, al.id, site.id)
  check("requirement now satisfied", c2.ok && c2.unmet.length === 0)
  const r3 = await assignCleaner(org.id, job2.id, al.id)
  check("assignment now succeeds even in block mode", r3.assigned && r3.credentialWarnings.length === 0)

  console.log("An expired credential does NOT satisfy the requirement (block mode):")
  const site2 = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Annex", timezone: "UTC" } })
  await setSiteRequirements(org.id, site2.id, ["LICENSE"])
  await createCredential(org.id, { userId: al.id, type: "LICENSE", expiryDate: past }) // expired
  const job3 = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site2.id, title: "Annex clean", status: "SCHEDULED", scheduledStart: new Date(Date.now() + 86_400_000) } })
  const err2 = await threw(() => assignCleaner(org.id, job3.id, al.id))
  check("expired credential is treated as unmet and blocks", err2 !== null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL COMPLIANCE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
