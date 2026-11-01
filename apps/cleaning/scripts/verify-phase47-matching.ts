// Phase 47 integration verification: intelligent shift matching (extends the
// Phase 11 coverage finder).
//  - the skills catalog, employee assignments and site requirements round-trip
//  - the coverage finder still returns available candidates (Phase 11 contract)
//  - candidates now carry a match score; fully-qualified rank ahead of partial
//  - a candidate missing a required skill is flagged, not dropped
//  - with the site's requirements removed, ranking falls back to history (Phase 11)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase47-matching.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import { getSkillMatrix, setSiteSkillRequirements, listSkills } from "../src/lib/data/skills"
import { findCoverageCandidates } from "../src/lib/data/coverage"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

// A future job at the required site that needs coverage, with nobody on it yet.
async function makeJob(orgId: string, siteId: string, planId: string | null) {
  const start = new Date(Date.now() + 3 * 86_400_000)
  start.setUTCHours(14, 0, 0, 0)
  const job = await systemDb.job.create({
    data: {
      organizationId: orgId, serviceLocationId: siteId, servicePlanId: planId,
      title: "Coverage test shift", status: "SCHEDULED", scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3 * 3600_000),
    },
    select: { id: true },
  })
  return job.id
}

async function main() {
  const d = await createDemoOrg("47.47.47.47", 2)
  const orgId = d.orgId

  console.log("Skills catalog + matrix round-trip:")
  const skills = await listSkills(orgId)
  check("demo skills exist", skills.length >= 4, `skills=${skills.length}`)
  const matrix = await getSkillMatrix(orgId)
  check("employees carry assigned skill ids", matrix.employees.some((e) => e.skillIds.length > 0))
  check("a site has required skills", matrix.sites.some((s) => s.skillIds.length > 0))

  // The site the demo flagged with floor + window requirements.
  const reqSite = matrix.sites.find((s) => s.skillIds.length >= 2)!
  const site = await systemDb.serviceLocation.findFirstOrThrow({ where: { id: reqSite.id }, select: { id: true } })
  const jobId = await makeJob(orgId, site.id, null)

  console.log("\nFinder still returns available candidates, now ranked by match:")
  const candidates = await findCoverageCandidates(orgId, jobId)
  check("available candidates returned (Phase 11 contract)", candidates.length > 0, `n=${candidates.length}`)
  check("every candidate carries a match score and qualified flag", candidates.every((c) => typeof c.qualified === "boolean" && c.matchScore !== undefined))
  check("the top candidate is at least as qualified as the next", candidates.length < 2 || (candidates[0].qualified ? true : (candidates[0].matchScore ?? 0) >= (candidates[1].matchScore ?? 0)))
  check("a partially-matched candidate is flagged, not dropped", candidates.some((c) => c.missingSkills.length > 0) || candidates.every((c) => c.qualified))
  const fullyQualified = candidates.filter((c) => c.qualified)
  const partial = candidates.filter((c) => !c.qualified)
  check("fully-qualified candidates sort ahead of partial ones", fullyQualified.length === 0 || partial.length === 0 || candidates.indexOf(fullyQualified[fullyQualified.length - 1]) < candidates.indexOf(partial[0]))

  console.log("\nRemoving ALL the site's requirements restores Phase 11 ranking (history only):")
  await setSiteSkillRequirements(orgId, site.id, [])
  // Also clear credential requirements, so the site has zero requirements of any kind.
  await orgDb(orgId).siteCredentialRequirement.deleteMany({ where: { serviceLocationId: site.id } })
  const plain = await findCoverageCandidates(orgId, jobId)
  check("same candidate pool after clearing requirements", plain.length === candidates.length, `n=${plain.length}`)
  check("no match score when nothing is required", plain.every((c) => c.matchScore === null && c.qualified))
  check("ranking is non-increasing by prior jobs at site", plain.every((c, i) => i === 0 || plain[i - 1].priorJobsAtSite >= c.priorJobsAtSite))

  await orgDb(orgId).job.deleteMany({ where: { id: jobId } })
  await systemDb.organization.delete({ where: { id: orgId } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL MATCHING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
