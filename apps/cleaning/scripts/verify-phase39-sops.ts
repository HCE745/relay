// Phase 39 integration verification: SOP library (no AI; Postgres FTS).
//  - versioning: a published version is immutable and readable forever; revising
//    creates a new version without rewriting the old one
//  - section-level full-text search returns the right section, applicable-first
//  - acknowledgment: recorded per version; a new version flags re-ack; interval
//    expiry flags re-ack; compliance shows current vs outstanding
//  - issue-category mapping; site applicability; assignment warning (not block)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase39-sops.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import {
  createSop, publishSop, reviseSop, updateSopDraft, getSopVersion, getPublishedSop,
  searchSections, acknowledgeSop, outstandingAcks, complianceForSop,
  sopsForIssueCategory, sopsForSite, sopAssignmentWarnings,
} from "../src/lib/data/sops"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "SOP Co", slug: `so-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const alice = await systemDb.user.create({ data: { organizationId: org.id, name: "Alice", email: `a-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const bob = await systemDb.user.create({ data: { organizationId: org.id, name: "Bob", email: `b-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "Clinic" } })

  console.log("Create + publish + section FTS:")
  const { id } = await createSop(org.id, mgr.id, {
    title: "Chemical Spill Response", category: "CHEMICAL", keywords: "spill PPE", requiresAck: true, reackIntervalDays: 365,
    appliesEveryone: true,
    sections: [
      { heading: "Step 1: Assess", body: "Identify the chemical from its label or SDS." },
      { heading: "Step 4: Containment", body: "Ring the spill with absorbent socks working from the outside in." },
    ],
  })
  await publishSop(org.id, id)
  const hits = await searchSections(org.id, "containment", { role: "CLEANER" })
  check("FTS returns the containment section", hits.some((h) => h.heading.includes("Containment")))
  check("FTS marks it applicable to the cleaner", hits[0]?.applicable === true)
  check("a title/keyword term also finds sections", (await searchSections(org.id, "PPE", { role: "CLEANER" })).length > 0)

  console.log("\nAcknowledgment (per version):")
  await acknowledgeSop(org.id, alice.id, id)
  check("Alice acked → not outstanding", !(await outstandingAcks(org.id, alice.id, "CLEANER")).some((o) => o.id === id))
  check("Bob never acked → outstanding (never)", (await outstandingAcks(org.id, bob.id, "CLEANER")).some((o) => o.id === id && o.reason === "never"))
  const dup = await acknowledgeSop(org.id, alice.id, id)
  check("acking twice is idempotent (immutable)", dup.already === true)

  console.log("\nVersioning: publish v2, v1 stays readable, prior ackers re-ack:")
  await reviseSop(org.id, id, mgr.id) // v2 draft copies v1 sections
  await updateSopDraft(org.id, id, mgr.id, {
    title: "Chemical Spill Response", category: "CHEMICAL", keywords: "spill PPE", requiresAck: true, reackIntervalDays: 365, appliesEveryone: true,
    sections: [
      { heading: "Step 1: Assess", body: "Identify the chemical from its label or SDS." },
      { heading: "Step 4: Containment", body: "Ring the spill with pads. NEW: evacuate within 10 feet first." },
    ],
  })
  await publishSop(org.id, id)
  const v1 = await getSopVersion(org.id, id, 1)
  check("v1 is immutable (original containment text intact)", !!v1?.sections.find((s) => s.body.includes("outside in")) && !v1?.sections.some((s) => s.body.includes("evacuate")))
  const pub = await getPublishedSop(org.id, id)
  check("the published version is now v2", pub?.version === 2 && pub.sections.some((s) => s.body.includes("evacuate")))
  check("Alice (acked v1) must re-acknowledge v2", (await outstandingAcks(org.id, alice.id, "CLEANER")).some((o) => o.id === id && o.reason === "new_version"))
  await acknowledgeSop(org.id, alice.id, id)
  check("after re-acking v2, Alice is clear", !(await outstandingAcks(org.id, alice.id, "CLEANER")).some((o) => o.id === id))

  console.log("\nRe-acknowledgment interval:")
  // Backdate Alice's v2 ack beyond the 365-day interval.
  await orgDb(org.id).sopAcknowledgment.updateMany({ where: { sopId: id, userId: alice.id, version: 2 }, data: { acknowledgedAt: new Date(Date.now() - 400 * 86_400_000) } })
  check("expired ack → outstanding (expired)", (await outstandingAcks(org.id, alice.id, "CLEANER")).some((o) => o.id === id && o.reason === "expired"))

  console.log("\nCompliance view:")
  const comp = await complianceForSop(org.id, id)
  const aRow = comp.rows.find((r) => r.userId === alice.id)
  const bRow = comp.rows.find((r) => r.userId === bob.id)
  check("Alice shows expired, Bob shows outstanding", aRow?.status === "expired" && bRow?.status === "outstanding")

  console.log("\nMapping + site applicability + assignment warning:")
  await orgDb(org.id).sopIssueMapping.create({ data: { organizationId: org.id, issueCategory: "SAFETY", sopId: id } })
  check("issue category SAFETY maps to the spill SOP", (await sopsForIssueCategory(org.id, "SAFETY")).some((s) => s.id === id))
  const { id: siteSopId } = await createSop(org.id, mgr.id, { title: "Clinic Protocol", category: "SITE_SPECIFIC", appliesEveryone: false, appliesSiteIds: [site.id], requiresAck: false, sections: [{ heading: "Masks", body: "Wear a mask in clinical areas." }] })
  await publishSop(org.id, siteSopId)
  const siteSops = await sopsForSite(org.id, site.id)
  check("site shows its site-specific SOP + everyone SOPs", siteSops.some((s) => s.id === siteSopId) && siteSops.some((s) => s.id === id))
  const warnings = await sopAssignmentWarnings(org.id, bob.id, "CLEANER", site.id)
  check("assigning Bob warns about the unacknowledged required SOP", warnings.some((w) => w.includes("Chemical Spill Response")))

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL SOP CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
