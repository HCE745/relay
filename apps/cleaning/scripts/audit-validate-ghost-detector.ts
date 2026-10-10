// Validates scripts/detect-ghost-jobs.ts against KNOWN data: one plan with a
// deliberately-planted ghost (two jobs, one site-local day, the newer untouched)
// and one clean plan (one job/day, worked). Asserts the detector flags exactly
// the ghost and nothing else. Read-only detector; this harness does the seeding.
//
// Usage: DATABASE_URL=... tsx scripts/audit-validate-ghost-detector.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { detectGhosts } from "./detect-ghost-jobs"

let failures = 0
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "GhostTest", slug: `gt-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: "Daily", frequency: "DAILY", startTime: "09:00", startDate: new Date("2026-10-01T00:00:00Z"), isActive: true } })

  const day = "2026-10-05"
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "C", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  // The real (moved + worked) job on that day at 14:00 — created first.
  const real = await systemDb.job.create({
    data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Daily", status: "COMPLETED",
      plannedStart: new Date(`${day}T14:00:00Z`), scheduledStart: new Date(`${day}T14:00:00Z`), createdAt: new Date("2026-10-01T00:00:00Z"),
      assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "COMPLETED" }] } },
    select: { id: true },
  })
  // The GHOST: regenerated later at the original 09:00 grid slot, untouched.
  const ghost = await systemDb.job.create({
    data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Daily", status: "SCHEDULED",
      plannedStart: new Date(`${day}T09:00:00Z`), scheduledStart: new Date(`${day}T09:00:00Z`), createdAt: new Date("2026-10-04T08:00:00Z") },
    select: { id: true },
  })
  // Other days: one clean job each (no duplicates) so the plan isn't trivially flagged everywhere.
  for (const d of ["2026-10-02", "2026-10-03", "2026-10-04"]) {
    await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: "Daily", status: "COMPLETED", plannedStart: new Date(`${d}T09:00:00Z`), scheduledStart: new Date(`${d}T09:00:00Z`) } })
  }

  // A completely clean second plan — must NOT be flagged.
  const plan2 = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: "Weekly", frequency: "WEEKLY", startTime: "08:00", startDate: new Date("2026-10-01T00:00:00Z"), isActive: true } })
  await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan2.id, title: "Weekly", status: "SCHEDULED", plannedStart: new Date("2026-10-01T08:00:00Z"), scheduledStart: new Date("2026-10-01T08:00:00Z") } })

  const r = await detectGhosts(org.id)
  console.log(r.lines.join("\n"))

  check("flagged exactly one ghost candidate", r.candidateIds.length === 1, `ids=${JSON.stringify(r.candidateIds)}`)
  check("the flagged candidate is the GHOST (09:00, untouched)", r.candidateIds[0] === ghost.id)
  check("did NOT flag the real worked job", !r.candidateIds.includes(real.id))
  check("detected the same-day cluster", r.totalClusters === 1, `clusters=${r.totalClusters}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "DETECTOR VALIDATED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
