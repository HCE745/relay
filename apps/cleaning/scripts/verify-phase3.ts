// Phase 3 integration verification: field execution (clock in/out, checklist,
// completion), proof photos, problem reports, timezone config, multi-cleaner
// rules, and tenant isolation across every new surface.

import { systemDb, orgDb } from "../src/lib/org-db"
import { ReferenceError, ForbiddenActionError, ConflictError, RequirementsError } from "../src/lib/data/errors"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate, updateChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createManualJob, getJob } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { clockIn, clockOut, toggleChecklistItem } from "../src/lib/scheduling/execution"
import { uploadJobPhoto, getPhotoForServe } from "../src/lib/data/photos"
import { reportProblem, listJobIssues } from "../src/lib/data/issues"
import { getFieldJob } from "../src/lib/data/field"
import { getOrgTimezone, updateOrgTimezone } from "../src/lib/data/org"
import { validatePhoto } from "../src/lib/storage"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function expectThrows(name: string, fn: () => Promise<unknown>, type: new (...a: never[]) => Error) {
  let e: unknown
  try {
    await fn()
  } catch (err) {
    e = err
  }
  check(name, e instanceof type, e ? (e as Error).name : "did not throw")
}
const IMG = { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg" }

async function createCleaner(orgId: string, email: string, name: string, isActive = true) {
  return orgDb(orgId).user.create({
    data: { organizationId: orgId, email, name, password: "x", role: "CLEANER", isActive },
  })
}
async function makeJob(orgId: string, siteId: string, tplId: string, title: string) {
  return createManualJob(orgId, { serviceLocationId: siteId, title, date: "2026-07-01", startTime: "09:00", checklistTemplateId: tplId })
}

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await systemDb.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })

  const customer = await createCustomer(sparkle.id, { name: "Exec Corp" })
  const site = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "Exec Tower" })
  // Checklist: one plain-required item + one photo-required item.
  const tpl = await createChecklistTemplate(sparkle.id, {
    name: "Exec nightly",
    items: [
      { label: "Empty trash", isRequired: true, requirePhoto: false },
      { label: "Photo of lobby", isRequired: true, requirePhoto: true },
    ],
  })
  const simpleTpl = await createChecklistTemplate(sparkle.id, {
    name: "Simple",
    items: [{ label: "Wipe surfaces", isRequired: true, requirePhoto: false }],
  })

  const cleanerA = await createCleaner(sparkle.id, "a@sparkle.test", "Ana")
  const cleanerB = await createCleaner(sparkle.id, "b@sparkle.test", "Ben")

  const job = await makeJob(sparkle.id, site.id, tpl.id, "Exec job")
  await assignCleaner(sparkle.id, job.id, cleanerA.id)

  console.log("Clock-in:")
  const ci = await clockIn(sparkle.id, job.id, cleanerA.id, { source: "web" })
  check("assigned cleaner clocks in", !ci.alreadyOpen)
  const j1 = await getJob(sparkle.id, job.id)
  check("job → IN_PROGRESS with actualStart", j1?.status === "IN_PROGRESS" && !!j1?.actualStart)
  check("assignment → IN_PROGRESS", j1?.assignments[0].status === "IN_PROGRESS")
  check("open TimeEntry created", j1?.timeEntries.some((t) => t.status === "OPEN") ?? false)

  const ciAgain = await clockIn(sparkle.id, job.id, cleanerA.id, {})
  check("duplicate clock-in is idempotent (no second open entry)", ciAgain.alreadyOpen)

  await expectThrows("unassigned cleaner cannot clock in", () => clockIn(sparkle.id, job.id, cleanerB.id, {}), ForbiddenActionError)
  await expectThrows("cross-org clock-in rejected", () => clockIn(rival.id, job.id, cleanerA.id, {}), ReferenceError)

  const job2 = await makeJob(sparkle.id, site.id, simpleTpl.id, "Second job")
  await assignCleaner(sparkle.id, job2.id, cleanerA.id)
  await expectThrows("cannot clock into a second job while one is open", () => clockIn(sparkle.id, job2.id, cleanerA.id, {}), ConflictError)

  console.log("\nChecklist + required-work gate:")
  const items = j1!.checklistItems
  const trashItem = items.find((i) => i.label === "Empty trash")!
  const photoItem = items.find((i) => i.label === "Photo of lobby")!

  await toggleChecklistItem(sparkle.id, job.id, trashItem.id, cleanerA.id, { isComplete: true })
  await expectThrows("clock-out blocked while required photo missing", () => clockOut(sparkle.id, job.id, cleanerA.id, {}), RequirementsError)

  await expectThrows(
    "unassigned cleaner cannot toggle another job's item",
    () => toggleChecklistItem(sparkle.id, job.id, trashItem.id, cleanerB.id, { isComplete: true }),
    ForbiddenActionError,
  )

  await toggleChecklistItem(sparkle.id, job.id, photoItem.id, cleanerA.id, { isComplete: true })
  await expectThrows("clock-out still blocked: item marked done but no photo", () => clockOut(sparkle.id, job.id, cleanerA.id, {}), RequirementsError)

  console.log("\nProof photos:")
  const photo = await uploadJobPhoto(sparkle.id, job.id, cleanerA.id, { ...IMG, sizeBytes: IMG.data.length, jobChecklistItemId: photoItem.id })
  check("photo has uploader + size + association metadata", photo.uploadedById === cleanerA.id && photo.sizeBytes > 0 && photo.jobChecklistItemId === photoItem.id)
  const served = await getPhotoForServe(sparkle.id, photo.id)
  check("photo bytes are retrievable", (served?.bytes.length ?? 0) > 0)
  check("cross-org photo fetch returns nothing", (await getPhotoForServe(rival.id, photo.id)) === null)
  await expectThrows("cross-org photo upload rejected", () => uploadJobPhoto(rival.id, job.id, cleanerA.id, { ...IMG, sizeBytes: 4 }), ReferenceError)
  check("invalid file type rejected", validatePhoto("text/plain", 10) !== null)
  check("oversize file rejected", validatePhoto("image/jpeg", 20 * 1024 * 1024) !== null)

  console.log("\nCompletion:")
  const done = await clockOut(sparkle.id, job.id, cleanerA.id, { source: "web" })
  check("clock-out succeeds once requirements met", done.closed && done.jobCompleted)
  const j2 = await getJob(sparkle.id, job.id)
  check("job → COMPLETED with actualEnd", j2?.status === "COMPLETED" && !!j2?.actualEnd)
  check("TimeEntry closed (COMPLETED)", j2?.timeEntries.every((t) => t.status === "COMPLETED") ?? false)
  check("assignment → COMPLETED", j2?.assignments[0].status === "COMPLETED")

  console.log("\nSnapshot immutability during execution:")
  await updateChecklistTemplate(sparkle.id, tpl.id, { items: [{ label: "Totally different", isRequired: true, requirePhoto: false }] })
  const j3 = await getJob(sparkle.id, job.id)
  check("template edit does not alter completed job's checklist", j3?.checklistItems.length === 2 && j3?.checklistItems.some((i) => i.label === "Empty trash"))

  console.log("\nMulti-cleaner completion:")
  const mJob = await makeJob(sparkle.id, site.id, simpleTpl.id, "Crew job")
  await assignCleaner(sparkle.id, mJob.id, cleanerA.id)
  await assignCleaner(sparkle.id, mJob.id, cleanerB.id)
  await clockIn(sparkle.id, mJob.id, cleanerA.id, {})
  await clockIn(sparkle.id, mJob.id, cleanerB.id, {})
  const wipe = (await getJob(sparkle.id, mJob.id))!.checklistItems[0]
  await toggleChecklistItem(sparkle.id, mJob.id, wipe.id, cleanerA.id, { isComplete: true })
  await clockOut(sparkle.id, mJob.id, cleanerA.id, {})
  const mMid = await getJob(sparkle.id, mJob.id)
  check("job stays IN_PROGRESS while a crew member is still clocked in", mMid?.status === "IN_PROGRESS")
  await clockOut(sparkle.id, mJob.id, cleanerB.id, {})
  const mEnd = await getJob(sparkle.id, mJob.id)
  check("job COMPLETED after the last crew member clocks out", mEnd?.status === "COMPLETED")

  console.log("\nProblem reports:")
  const issue = await reportProblem(sparkle.id, mJob.id, cleanerB.id, { category: "EQUIPMENT", description: "Vacuum broke" })
  check("problem report created (OPEN, reporter set)", issue.status === "OPEN" && issue.reportedById === cleanerB.id)
  const issues = await listJobIssues(sparkle.id, mJob.id)
  check("issue visible to management on the job", issues.length === 1 && issues[0].category === "EQUIPMENT")
  await expectThrows("cannot report a problem on another org's job", () => reportProblem(rival.id, mJob.id, cleanerB.id, { category: "OTHER", description: "x" }), ReferenceError)

  console.log("\nField access isolation:")
  check("assigned cleaner can open their job", (await getFieldJob(sparkle.id, cleanerA.id, job.id)) !== null)
  const unassignedJob = await makeJob(sparkle.id, site.id, simpleTpl.id, "Not mine")
  check("cleaner cannot open a job they are not assigned to", (await getFieldJob(sparkle.id, cleanerB.id, unassignedJob.id)) === null)
  check("cross-org field access returns nothing", (await getFieldJob(rival.id, cleanerA.id, job.id)) === null)

  console.log("\nTimezone config:")
  const before = await getOrgTimezone(sparkle.id)
  await updateOrgTimezone(sparkle.id, "America/Chicago")
  check("org timezone update persists", (await getOrgTimezone(sparkle.id)) === "America/Chicago", `was ${before}`)
  const laSite = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "LA site", timezone: "America/Los_Angeles" })
  check("site timezone override stored", laSite.timezone === "America/Los_Angeles")
  await updateOrgTimezone(sparkle.id, before) // restore

  console.log(`\n${failures === 0 ? "ALL PHASE 3 CHECKS PASSED" : `${failures} PHASE 3 CHECK(S) FAILED`}`)
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
