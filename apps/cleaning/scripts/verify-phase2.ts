// Phase 2 integration verification against a live database: job generation
// (idempotent + DB-enforced), checklist snapshot immutability, cleaner
// assignments, and tenant isolation across all new surfaces.

import { systemDb, orgDb, isUniqueViolation } from "../src/lib/org-db"
import { ReferenceError } from "../src/lib/data/errors"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate, updateChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createServicePlan, updateServicePlan } from "../src/lib/data/service-plans"
import { generateJobsForServicePlan } from "../src/lib/scheduling/generation"
import { listJobsInWindow, getJob, updateJob, cancelJob, createManualJob } from "../src/lib/data/jobs"
import { assignCleaner, removeAssignment } from "../src/lib/data/assignments"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function expectThrows(name: string, fn: () => Promise<unknown>, type: new (...a: never[]) => Error) {
  let thrown: unknown
  try {
    await fn()
  } catch (e) {
    thrown = e
  }
  check(name, thrown instanceof type, thrown ? (thrown as Error).name : "did not throw")
}
const DAY = 86_400_000

async function createCleaner(orgId: string, email: string, name: string, isActive = true) {
  return orgDb(orgId).user.create({
    data: { organizationId: orgId, email, name, password: "x", role: "CLEANER", isActive },
  })
}

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await systemDb.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })
  const now = new Date()

  // ── Fixtures ────────────────────────────────────────────────────────────────
  const customer = await createCustomer(sparkle.id, { name: "Nightly Corp" })
  const site = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "Tower A" })
  const tpl = await createChecklistTemplate(sparkle.id, {
    name: "Nightly",
    items: [{ label: "Empty trash", isRequired: true, requirePhoto: false }],
  })
  const plan = await createServicePlan(sparkle.id, {
    serviceLocationId: site.id,
    name: "Nightly clean",
    frequency: "DAILY",
    startTime: "09:00",
    crewSize: 2,
    checklistTemplateId: tpl.id,
    startDate: new Date(now.getTime() - 3 * DAY),
  })

  console.log("Generation — idempotent + snapshot:")
  const winAStart = now
  const winAEnd = new Date(now.getTime() + 30 * DAY)
  const r1 = await generateJobsForServicePlan(sparkle.id, plan.id, winAStart, winAEnd)
  check("first generation creates jobs", r1.created > 0, `${r1.created} created`)

  const r2 = await generateJobsForServicePlan(sparkle.id, plan.id, winAStart, winAEnd)
  check("rerun is idempotent (no duplicates)", r2.created === 0 && r2.skipped === r1.created, `skipped ${r2.skipped}`)

  const outOfRange = await generateJobsForServicePlan(
    sparkle.id,
    plan.id,
    new Date(now.getTime() - 60 * DAY),
    new Date(now.getTime() - 40 * DAY),
  )
  check("out-of-range window generates nothing", outOfRange.created === 0)

  // DB-level uniqueness (not just app checks): a direct duplicate insert fails.
  const anyJob = (await listJobsInWindow(sparkle.id, winAStart, winAEnd))[0]
  let dupErr: unknown
  try {
    await orgDb(sparkle.id).job.create({
      data: {
        organizationId: sparkle.id,
        serviceLocationId: site.id,
        servicePlanId: plan.id,
        title: "dupe",
        status: "SCHEDULED",
        scheduledStart: anyJob.scheduledStart,
      },
    })
  } catch (e) {
    dupErr = e
  }
  check("DB unique blocks duplicate (servicePlanId, scheduledStart) with P2002", isUniqueViolation(dupErr))

  console.log("\nSnapshot immutability:")
  const firstJobFull = await getJob(sparkle.id, anyJob.id)
  check("generated job received the checklist snapshot", firstJobFull?.checklistItems.length === 1)

  await updateChecklistTemplate(sparkle.id, tpl.id, {
    items: [
      { label: "Empty trash", isRequired: true, requirePhoto: false },
      { label: "Vacuum floors", isRequired: true, requirePhoto: false },
      { label: "Mop", isRequired: true, requirePhoto: false },
    ],
  })
  const afterEdit = await getJob(sparkle.id, anyJob.id)
  check(
    "editing the template does NOT change an existing Job's checklist",
    afterEdit?.checklistItems.length === 1 && afterEdit?.checklistItems[0].label === "Empty trash",
  )

  const r3 = await generateJobsForServicePlan(sparkle.id, plan.id, new Date(now.getTime() + 30 * DAY), new Date(now.getTime() + 45 * DAY))
  check("later window generates new jobs", r3.created > 0)
  const laterJob = (await listJobsInWindow(sparkle.id, new Date(now.getTime() + 30 * DAY), new Date(now.getTime() + 45 * DAY)))[0]
  const laterFull = await getJob(sparkle.id, laterJob.id)
  check("newer jobs receive the UPDATED template (3 items)", laterFull?.checklistItems.length === 3)

  console.log("\nAssignments:")
  const cleanerA = await createCleaner(sparkle.id, "c-a@sparkle.test", "Cleaner A")
  const cleanerB = await createCleaner(sparkle.id, "c-b@sparkle.test", "Cleaner B")
  const inactive = await createCleaner(sparkle.id, "c-off@sparkle.test", "Inactive Cleaner", false)

  const a1 = await assignCleaner(sparkle.id, anyJob.id, cleanerA.id)
  check("assign a cleaner", a1.assigned)
  const jobAfterAssign = await getJob(sparkle.id, anyJob.id)
  check("job advances SCHEDULED → ASSIGNED", jobAfterAssign?.status === "ASSIGNED")

  const a1again = await assignCleaner(sparkle.id, anyJob.id, cleanerA.id)
  check("re-assigning the same cleaner is a no-op", a1again.alreadyAssigned)

  await assignCleaner(sparkle.id, anyJob.id, cleanerB.id)
  const twoAssignees = await getJob(sparkle.id, anyJob.id)
  check("multiple cleaners can be assigned", twoAssignees?.assignments.length === 2)

  await removeAssignment(sparkle.id, anyJob.id, cleanerB.id)
  const oneLeft = await getJob(sparkle.id, anyJob.id)
  check("remove one assignee keeps job ASSIGNED", oneLeft?.assignments.length === 1 && oneLeft?.status === "ASSIGNED")

  await removeAssignment(sparkle.id, anyJob.id, cleanerA.id)
  const noneLeft = await getJob(sparkle.id, anyJob.id)
  check("removing the last assignee reverts job to SCHEDULED", noneLeft?.assignments.length === 0 && noneLeft?.status === "SCHEDULED")

  await expectThrows("inactive cleaner is rejected", () => assignCleaner(sparkle.id, anyJob.id, inactive.id), ReferenceError)

  console.log("\nInactive plan:")
  await updateServicePlan(sparkle.id, plan.id, { isActive: false })
  const inactiveGen = await generateJobsForServicePlan(sparkle.id, plan.id, winAStart, winAEnd)
  check("inactive plan generates no work", inactiveGen.planActive === false && inactiveGen.created === 0)

  console.log("\nTenant isolation:")
  const rivalCleaner = await createCleaner(rival.id, "c@rival.test", "Rival Cleaner")
  const rivalCustomer = await createCustomer(rival.id, { name: "Rival Co" })
  const rivalSite = await createServiceLocation(rival.id, { customerId: rivalCustomer.id, name: "Rival Site" })
  const rivalTpl = await createChecklistTemplate(rival.id, { name: "R", items: [{ label: "x", isRequired: true, requirePhoto: false }] })

  check("Rival cannot READ Sparkle's job", (await getJob(rival.id, anyJob.id)) === null)
  check("Rival cannot UPDATE Sparkle's job", (await updateJob(rival.id, anyJob.id, { title: "hax" })) === null)
  check("Rival cannot CANCEL Sparkle's job", (await cancelJob(rival.id, anyJob.id)) === false)
  await expectThrows("Rival cannot GENERATE Sparkle's plan", () => generateJobsForServicePlan(rival.id, plan.id, winAStart, winAEnd), ReferenceError)
  await expectThrows("Rival cannot assign to a Sparkle job", () => assignCleaner(rival.id, anyJob.id, rivalCleaner.id), ReferenceError)
  await expectThrows(
    "Cannot assign another org's cleaner to a Sparkle job",
    () => assignCleaner(sparkle.id, anyJob.id, rivalCleaner.id),
    ReferenceError,
  )
  await expectThrows(
    "Manual job cannot use another org's site",
    () => createManualJob(rival.id, { serviceLocationId: site.id, title: "x", date: "2026-06-01", startTime: "09:00" }),
    ReferenceError,
  )
  await expectThrows(
    "Manual job cannot use another org's checklist",
    () => createManualJob(sparkle.id, { serviceLocationId: site.id, title: "x", date: "2026-06-01", startTime: "09:00", checklistTemplateId: rivalTpl.id }),
    ReferenceError,
  )
  // touch rivalSite so it isn't flagged unused
  check("rival fixtures isolated", rivalSite.organizationId === rival.id)

  console.log(`\n${failures === 0 ? "ALL PHASE 2 CHECKS PASSED" : `${failures} PHASE 2 CHECK(S) FAILED`}`)
}

main()
  .then(async () => {
    await systemDb.$disconnect()
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch(async (e) => {
    console.error(e)
    await systemDb.$disconnect()
    process.exit(1)
  })
