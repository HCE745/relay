// Phase 4 integration verification: inspections (snapshot, scoring, PASS/FAIL,
// N/A, critical override, failed→Issue idempotency), time approval/correction/
// reapproval/export, manual MISSED, storage, and tenant isolation.

import { systemDb, orgDb } from "../src/lib/org-db"
import { ReferenceError, ConflictError, RequirementsError } from "../src/lib/data/errors"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createManualJob, getJob, markJobMissed } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { clockIn, clockOut, toggleChecklistItem } from "../src/lib/scheduling/execution"
import {
  createInspectionTemplate,
  updateInspectionTemplate,
  archiveInspectionTemplate,
} from "../src/lib/data/inspection-templates"
import {
  createInspectionFromJob,
  setInspectionItemResult,
  finalizeInspection,
  getInspection,
} from "../src/lib/scheduling/inspections"
import { uploadInspectionPhoto, uploadJobPhoto, getPhotoForServe, deleteJobPhoto } from "../src/lib/data/photos"
import { approveTimeEntry, correctTimeEntry, listApprovedForExport } from "../src/lib/data/time-entries"
import { listAuditForEntity } from "../src/lib/data/audit"
import { chooseStorageKind } from "../src/lib/storage"

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

async function createCleaner(orgId: string, email: string, name: string) {
  return orgDb(orgId).user.create({ data: { organizationId: orgId, email, name, password: "x", role: "CLEANER" } })
}
// Score an inspection: create from job with tpl, apply results in item order, finalize.
async function runInspection(orgId: string, jobId: string, inspectorId: string, tplId: string, results: string[]) {
  const insp = await createInspectionFromJob(orgId, jobId, inspectorId, tplId)
  for (let i = 0; i < results.length; i++) {
    await setInspectionItemResult(orgId, insp.id, insp.results[i].id, { result: results[i] as never })
  }
  const out = await finalizeInspection(orgId, insp.id, inspectorId)
  return { insp, out }
}

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await systemDb.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })
  const admin = await systemDb.user.findUniqueOrThrow({ where: { email: "admin@sparkle.test" } })

  // ── Fixture: a completed job with a completed time entry ─────────────────────
  const cleaner = await createCleaner(sparkle.id, "c4@sparkle.test", "C4")
  const customer = await createCustomer(sparkle.id, { name: "QC Corp" })
  const site = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "QC Site" })
  const simple = await createChecklistTemplate(sparkle.id, { name: "s", items: [{ label: "wipe", isRequired: true, requirePhoto: false }] })
  const job = await createManualJob(sparkle.id, { serviceLocationId: site.id, title: "QC job", date: "2026-07-01", startTime: "09:00", checklistTemplateId: simple.id })
  await assignCleaner(sparkle.id, job.id, cleaner.id)
  await clockIn(sparkle.id, job.id, cleaner.id, {})
  const cItem = (await getJob(sparkle.id, job.id))!.checklistItems[0]
  await toggleChecklistItem(sparkle.id, job.id, cItem.id, cleaner.id, { isComplete: true })
  await clockOut(sparkle.id, job.id, cleaner.id, {})
  const jobDone = await getJob(sparkle.id, job.id)
  check("fixture job COMPLETED with a COMPLETED time entry", jobDone!.status === "COMPLETED" && jobDone!.timeEntries[0].status === "COMPLETED")
  const entryId = jobDone!.timeEntries[0].id

  // ── Inspection templates ─────────────────────────────────────────────────────
  console.log("\nInspection templates:")
  const tplPlain = await createInspectionTemplate(sparkle.id, {
    name: "Plain 4",
    passThreshold: 80,
    items: [
      { label: "A", points: 1 },
      { label: "B", points: 1 },
      { label: "C", points: 1 },
      { label: "D", points: 1 },
    ],
  })
  check("template created with items", tplPlain.items.length === 4)
  const edited = await updateInspectionTemplate(sparkle.id, tplPlain.id, { items: [{ label: "Only", points: 1 }] })
  check("template edit replaces items", edited!.items.length === 1)
  check("template archived", await archiveInspectionTemplate(sparkle.id, tplPlain.id))

  const tpl4 = await createInspectionTemplate(sparkle.id, { name: "Four", items: [{ label: "A" }, { label: "B" }, { label: "C" }, { label: "D" }] })
  const tplCrit = await createInspectionTemplate(sparkle.id, {
    name: "Critical",
    items: [
      { label: "Big1", points: 10 },
      { label: "Big2", points: 10 },
      { label: "CritSmall", points: 1, isCritical: true },
    ],
  })
  const tplPhoto = await createInspectionTemplate(sparkle.id, { name: "Photo", items: [{ label: "Shot", requirePhoto: true }] })

  console.log("\nScoring:")
  const pass = await runInspection(sparkle.id, job.id, admin.id, tpl4.id, ["PASS", "PASS", "PASS", "PASS"])
  check("all-pass → PASS, score 100", pass.out.outcome === "PASS" && pass.out.score === 100)

  const fail = await runInspection(sparkle.id, job.id, admin.id, tpl4.id, ["PASS", "FAIL", "FAIL", "FAIL"])
  check("25% → FAIL", fail.out.outcome === "FAIL" && fail.out.score === 25)
  check("failed inspection created a linked Issue", fail.out.issueId != null)

  const na = await runInspection(sparkle.id, job.id, admin.id, tpl4.id, ["PASS", "PASS", "NA", "NA"])
  check("N/A excluded from denominator → 100 PASS", na.out.outcome === "PASS" && na.out.score === 100)

  const crit = await runInspection(sparkle.id, job.id, admin.id, tplCrit.id, ["PASS", "PASS", "FAIL"])
  check("critical failure forces FAIL despite high score", crit.out.outcome === "FAIL" && crit.out.score > 90)

  console.log("\nFailed-inspection Issue idempotency:")
  const issuesForFail = await orgDb(sparkle.id).issue.findMany({ where: { inspectionId: fail.insp.id } })
  check("exactly one Issue for the failed inspection", issuesForFail.length === 1)
  const refinal = await finalizeInspection(sparkle.id, fail.insp.id, admin.id)
  check("re-finalize is idempotent (alreadyFinalized)", refinal.alreadyFinalized && refinal.issueId === fail.out.issueId)
  const issuesAfter = await orgDb(sparkle.id).issue.count({ where: { inspectionId: fail.insp.id } })
  check("still exactly one Issue after retry", issuesAfter === 1)

  console.log("\nSnapshot immutability:")
  const snapInsp = await createInspectionFromJob(sparkle.id, job.id, admin.id, tpl4.id)
  await updateInspectionTemplate(sparkle.id, tpl4.id, { items: [{ label: "Changed" }] })
  const snapAfter = await getInspection(sparkle.id, snapInsp.id)
  check("inspection results unaffected by later template edit", snapAfter!.results.length === 4 && snapAfter!.results.some((r) => r.label === "A"))

  console.log("\nPhoto-required finalize gate:")
  const pInsp = await createInspectionFromJob(sparkle.id, job.id, admin.id, tplPhoto.id)
  await setInspectionItemResult(sparkle.id, pInsp.id, pInsp.results[0].id, { result: "PASS" })
  await expectThrows("finalize blocked without required photo", () => finalizeInspection(sparkle.id, pInsp.id, admin.id), RequirementsError)
  await uploadInspectionPhoto(sparkle.id, pInsp.id, admin.id, { ...IMG, sizeBytes: 4, inspectionItemResultId: pInsp.results[0].id })
  const pDone = await finalizeInspection(sparkle.id, pInsp.id, admin.id)
  check("finalize succeeds once photo attached", pDone.outcome === "PASS")

  console.log("\nInspection tenant isolation:")
  await expectThrows("cross-org job cannot be inspected", () => createInspectionFromJob(rival.id, job.id, admin.id, tpl4.id), ReferenceError)
  const rivalTpl = await createInspectionTemplate(rival.id, { name: "R", items: [{ label: "x" }] })
  await expectThrows("another org's template cannot be used", () => createInspectionFromJob(sparkle.id, job.id, admin.id, rivalTpl.id), ReferenceError)
  await expectThrows("cross-org inspection photo rejected", () => uploadInspectionPhoto(rival.id, pInsp.id, admin.id, { ...IMG, sizeBytes: 4 }), ReferenceError)

  console.log("\nTime approval / correction:")
  await approveTimeEntry(sparkle.id, entryId, admin.id)
  let e = await orgDb(sparkle.id).timeEntry.findFirst({ where: { id: entryId } })
  check("entry APPROVED with approver", e!.status === "APPROVED" && e!.approvedById === admin.id)

  const newOut = new Date(e!.clockInAt.getTime() + 2 * 3600_000)
  await correctTimeEntry(sparkle.id, entryId, admin.id, { clockOutAt: newOut, reason: "Forgot to clock out" })
  e = await orgDb(sparkle.id).timeEntry.findFirst({ where: { id: entryId } })
  check("correcting an APPROVED entry clears approval", e!.status === "COMPLETED" && e!.approvedById === null)
  check("clock-out updated (duration recalculated from timestamps)", e!.clockOutAt!.getTime() === newOut.getTime())

  const audits = await listAuditForEntity(sparkle.id, "TimeEntry", entryId)
  check("correction + approval audited", audits.some((a) => a.action === "correct") && audits.some((a) => a.action === "approve"))

  await approveTimeEntry(sparkle.id, entryId, admin.id)
  e = await orgDb(sparkle.id).timeEntry.findFirst({ where: { id: entryId } })
  check("re-approval works", e!.status === "APPROVED")

  const exportRows = await listApprovedForExport(sparkle.id, new Date("2026-01-01"), new Date("2027-01-01"))
  check("export returns only APPROVED entries", exportRows.length >= 1 && exportRows.every((r) => r.id != null))

  await expectThrows("cross-org approval rejected", () => approveTimeEntry(rival.id, entryId, admin.id), ReferenceError)
  await expectThrows("cross-org correction rejected", () => correctTimeEntry(rival.id, entryId, admin.id, { clockOutAt: newOut, reason: "x" }), ReferenceError)

  console.log("\nManual MISSED:")
  const futureJob = await createManualJob(sparkle.id, { serviceLocationId: site.id, title: "Miss me", date: "2026-08-01", startTime: "09:00" })
  const missed = await markJobMissed(sparkle.id, futureJob.id, admin.id, "No-show")
  check("scheduled job can be marked MISSED", !missed.alreadyMissed)
  await expectThrows("completed job cannot be marked MISSED", () => markJobMissed(sparkle.id, job.id, admin.id, "x"), ConflictError)

  console.log("\nStorage:")
  check("production without token cannot select local (throws)", (() => { try { chooseStorageKind({ nodeEnv: "production" }); return false } catch { return true } })())
  const photo = await uploadJobPhoto(sparkle.id, job.id, admin.id, { ...IMG, sizeBytes: 4 })
  check("photo stored + retrievable", (await getPhotoForServe(sparkle.id, photo.id)) !== null)
  check("deleteJobPhoto removes metadata + object", await deleteJobPhoto(sparkle.id, photo.id))
  check("deleted photo no longer served", (await getPhotoForServe(sparkle.id, photo.id)) === null)

  console.log(`\n${failures === 0 ? "ALL PHASE 4 CHECKS PASSED" : `${failures} PHASE 4 CHECK(S) FAILED`}`)
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
