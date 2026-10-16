// Phase 38 integration verification: public job board distribution.
//  - public listing shows only OPEN postings; a closed posting is not public
//    (its detail getter returns null, so the page 404s and the JSON-LD is gone)
//  - a per-posting application feeds the existing pipeline, linked to the posting
//  - source tracking: ?src is normalized and stored; empty → "careers_page"
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase38-careers.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { listPublicPostings, getPublicPosting, getPublicCareersOrg, createPublicApplication } from "../src/lib/data/hiring"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Sparkle Co", slug: `sp-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const open = await systemDb.jobPosting.create({ data: { organizationId: org.id, title: "Night Cleaner", description: "Clean offices.", employmentType: "Full-time", locations: "Detroit, MI", status: "OPEN" }, select: { id: true } })
  const closed = await systemDb.jobPosting.create({ data: { organizationId: org.id, title: "Old Role", status: "CLOSED" }, select: { id: true } })

  console.log("Public listing + visibility:")
  check("careers org resolves by slug", (await getPublicCareersOrg(org.slug))?.name === "Sparkle Co")
  const postings = await listPublicPostings(org.id)
  check("only the OPEN posting is listed", postings.length === 1 && postings[0]!.id === open.id)
  check("OPEN posting detail is available", (await getPublicPosting(org.id, open.id))?.title === "Night Cleaner")
  check("CLOSED posting detail returns null (page 404s, markup removed)", (await getPublicPosting(org.id, closed.id)) === null)

  console.log("\nPer-posting application feeds the pipeline, with source tracking:")
  await createPublicApplication(org.id, { name: "Pat Applicant", email: "pat@example.com", jobPostingId: open.id, source: "Indeed", website: "" }, "iphash1")
  const a1 = await systemDb.applicant.findFirst({ where: { organizationId: org.id, email: "pat@example.com" }, select: { jobPostingId: true, source: true, appliedFor: true, status: true } })
  check("applicant linked to the posting, status NEW", a1?.jobPostingId === open.id && a1?.status === "NEW")
  check("appliedFor snapshotted from the posting title", a1?.appliedFor === "Night Cleaner")
  check("source normalized to 'indeed'", a1?.source === "indeed")

  await createPublicApplication(org.id, { name: "Sam Walkup", email: "sam@example.com", jobPostingId: open.id, website: "" }, "iphash2")
  const a2 = await systemDb.applicant.findFirst({ where: { organizationId: org.id, email: "sam@example.com" }, select: { source: true } })
  check("no src → source defaults to 'careers_page'", a2?.source === "careers_page")

  await createPublicApplication(org.id, { name: "Lee Ref", email: "lee@example.com", jobPostingId: open.id, source: "a friend (referral!)", website: "" }, "iphash3")
  const a3 = await systemDb.applicant.findFirst({ where: { organizationId: org.id, email: "lee@example.com" }, select: { source: true } })
  check("free-text src with a known keyword → 'referral'", a3?.source === "referral")

  console.log("\nClosed postings reject applications:")
  let rejected = false
  try { await createPublicApplication(org.id, { name: "X", email: "x@example.com", jobPostingId: closed.id, website: "" }, "iphash4") } catch { rejected = true }
  check("cannot apply to a closed posting", rejected)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL CAREERS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
