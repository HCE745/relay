// Phase 34 integration verification: asset-linked issue history + the full
// issue lifecycle recorded in the ONE existing AuditEvent stream (no second
// audit system, no duplicate of the maintenance log).
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase34-asset-history.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { reportProblem, assignIssue, setIssueStatus, verifyIssue, setIssueAsset, addIssueComment, listAssetIssues, listIssueActivity } from "../src/lib/data/issues"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Asset Co", slug: `as-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const tech = await systemDb.user.create({ data: { organizationId: org.id, name: "Tech", email: `t-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const verifier = await systemDb.user.create({ data: { organizationId: org.id, name: "QA", email: `q-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Clean", status: "COMPLETED", scheduledStart: new Date(), plannedStart: new Date() }, select: { id: true } })
  const asset = await systemDb.asset.create({ data: { organizationId: org.id, name: "Auto-scrubber #1", category: "MACHINE", status: "ACTIVE" } })
  const otherAsset = await systemDb.asset.create({ data: { organizationId: org.id, name: "Vacuum #2", category: "EQUIPMENT", status: "ACTIVE" } })

  console.log("Report an issue linked to an asset at creation:")
  const a = await reportProblem(org.id, job.id, mgr.id, { category: "EQUIPMENT", description: "Won't power on", assetId: asset.id })
  check("issue stored with the asset link", (await systemDb.issue.findFirst({ where: { id: a.id }, select: { assetId: true } }))?.assetId === asset.id)

  console.log("\nRe-link to a different asset, then the history follows:")
  await setIssueAsset(org.id, a.id, mgr.id, otherAsset.id)
  check("re-link moves the issue to the other asset", (await listAssetIssues(org.id, otherAsset.id)).some((i) => i.id === a.id))
  check("original asset no longer lists it", !(await listAssetIssues(org.id, asset.id)).some((i) => i.id === a.id))
  await setIssueAsset(org.id, a.id, mgr.id, asset.id) // put it back

  console.log("\nAsset issue history lists reported problems (separate from maintenance):")
  const b = await reportProblem(org.id, job.id, mgr.id, { category: "EQUIPMENT", description: "Leaking water", assetId: asset.id })
  const hist = await listAssetIssues(org.id, asset.id)
  check("asset shows both issues, newest first", hist.length === 2 && hist[0]!.id === b.id)

  console.log("\nFull lifecycle is captured in the ONE AuditEvent stream:")
  await assignIssue(org.id, a.id, mgr.id, tech.id)
  await setIssueStatus(org.id, a.id, tech.id, "ACKNOWLEDGED")
  await setIssueStatus(org.id, a.id, tech.id, "RESOLVED")
  await addIssueComment(org.id, a.id, tech.id, "Replaced the power switch.")
  await verifyIssue(org.id, a.id, verifier.id)
  await setIssueStatus(org.id, a.id, mgr.id, "OPEN") // reopen
  const actions = (await listIssueActivity(org.id, a.id)).map((e) => e.action)
  for (const expected of ["report", "route", "assign", "status", "comment", "verify", "reopen", "link-asset"]) {
    check(`lifecycle includes "${expected}"`, actions.includes(expected))
  }
  check("all lifecycle events share entityType=Issue (no second audit system)",
    (await systemDb.auditEvent.count({ where: { organizationId: org.id, entityId: a.id, entityType: { not: "Issue" } } })) === 0)

  // Best-effort cleanup (embedded DB is ephemeral; FK restrict on comment→author
  // can block the org cascade and is irrelevant to the checks).
  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL ASSET-HISTORY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
