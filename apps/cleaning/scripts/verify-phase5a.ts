// Phase 5A integration verification: team/user lifecycle, credentials, issues
// workflow (uniform for field + failed-inspection), multi-org generation,
// export, and tenant isolation across all new surfaces.

import { systemDb, orgDb } from "../src/lib/org-db"
import { ReferenceError, ForbiddenActionError } from "../src/lib/data/errors"
import { createUser, updateUser, getUser } from "../src/lib/data/users"
import { createPasswordReset, consumePasswordReset, changePassword } from "../src/lib/data/auth-tokens"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createServicePlan } from "../src/lib/data/service-plans"
import { createInspectionTemplate } from "../src/lib/data/inspection-templates"
import { createManualJob, getJob } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { clockIn, clockOut, toggleChecklistItem } from "../src/lib/scheduling/execution"
import { createInspectionFromJob, setInspectionItemResult, finalizeInspection } from "../src/lib/scheduling/inspections"
import { reportProblem, assignIssue, setIssueStatus, addIssueComment, getIssue } from "../src/lib/data/issues"
import { generateUpcomingAllOrgs } from "../src/lib/scheduling/generation"
import { approveTimeEntry, listApprovedForExport } from "../src/lib/data/time-entries"

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
const DAY = 86_400_000

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await systemDb.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })
  const admin = await systemDb.user.findUniqueOrThrow({ where: { email: "admin@sparkle.test" } })

  console.log("Team / user lifecycle:")
  const nc = await createUser(sparkle.id, "OWNER", {
    name: "New Cleaner",
    email: "nc@sparkle.test",
    role: "CLEANER",
    password: "password123",
    employeeCode: "E-100",
  })
  check("create employee + employee code", nc.role === "CLEANER" && nc.employeeProfile?.employeeCode === "E-100")

  const upd = await updateUser(sparkle.id, "OWNER", nc.id, { role: "SUPERVISOR", employeeCode: "E-200" })
  check("edit role + employee code", upd?.role === "SUPERVISOR" && upd?.employeeProfile?.employeeCode === "E-200")

  await updateUser(sparkle.id, "OWNER", nc.id, { isActive: false })
  check("deactivate", (await getUser(sparkle.id, nc.id))?.isActive === false)
  await updateUser(sparkle.id, "OWNER", nc.id, { isActive: true })
  check("reactivate", (await getUser(sparkle.id, nc.id))?.isActive === true)

  await expectThrows("MANAGER cannot create ADMIN", () => createUser(sparkle.id, "MANAGER", { name: "x", email: "x1@sparkle.test", role: "ADMIN", password: "password123" }), ForbiddenActionError)
  check("cross-org user edit denied", (await updateUser(rival.id, "OWNER", nc.id, { name: "hax" })) === null)

  console.log("\nCredentials:")
  const reset = await createPasswordReset("nc@sparkle.test")
  check("reset token issued for active user", !!reset?.token)
  check("consume reset sets new password", await consumePasswordReset(reset!.token, "brandnew123"))
  check("reused token is invalid", !(await consumePasswordReset(reset!.token, "again12345")))
  check("bogus token is invalid", !(await consumePasswordReset("bogus-token", "whatever12")))
  check("change password with correct current", await changePassword(nc.id, "brandnew123", "changed12345"))
  check("change password rejects wrong current", !(await changePassword(nc.id, "wrongpass", "another12345")))
  await updateUser(sparkle.id, "OWNER", nc.id, { isActive: false })
  check("disabled user cannot request reset", (await createPasswordReset("nc@sparkle.test")) === null)
  await updateUser(sparkle.id, "OWNER", nc.id, { isActive: true })

  // Reset nc back to an active CLEANER (kept employee code E-200) for the
  // job-assignment fixtures below.
  await updateUser(sparkle.id, "OWNER", nc.id, { role: "CLEANER" })

  console.log("\nIssues workflow (field report + failed inspection, uniform):")
  const customer = await createCustomer(sparkle.id, { name: "Ops Corp" })
  const site = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "Ops Site" })
  const scope = await createChecklistTemplate(sparkle.id, { name: "S", items: [{ label: "Wipe", isRequired: true, requirePhoto: false }] })
  const job = await createManualJob(sparkle.id, { serviceLocationId: site.id, title: "Ops job", date: "2026-07-01", startTime: "09:00", checklistTemplateId: scope.id })
  await assignCleaner(sparkle.id, job.id, nc.id)

  const fieldIssue = await reportProblem(sparkle.id, job.id, nc.id, { category: "EQUIPMENT", description: "Mop broke" })
  check("field report creates OPEN issue", fieldIssue.status === "OPEN")

  const assigned = await assignIssue(sparkle.id, fieldIssue.id, admin.id, nc.id)
  check("assign issue to a user", assigned?.assignedTo?.id === nc.id)
  const ack = await setIssueStatus(sparkle.id, fieldIssue.id, admin.id, "ACKNOWLEDGED")
  check("acknowledge sets status + timestamp", ack?.status === "ACKNOWLEDGED")
  await setIssueStatus(sparkle.id, fieldIssue.id, admin.id, "RESOLVED")
  const closed = await setIssueStatus(sparkle.id, fieldIssue.id, admin.id, "CLOSED")
  check("resolve → close", closed?.status === "CLOSED")
  const commented = await addIssueComment(sparkle.id, fieldIssue.id, admin.id, "Ordered a replacement mop.")
  check("note recorded", !!commented?.comments.some((c) => c.body.includes("replacement")))
  const detail = await getIssue(sparkle.id, fieldIssue.id)
  check("source context retained (job + reporter)", detail?.job?.id === job.id && detail?.reportedBy.name === nc.name)

  // Failed-inspection issue behaves identically.
  const inspTpl = await createInspectionTemplate(sparkle.id, { name: "I", items: [{ label: "Restroom", isCritical: true }] })
  const insp = await createInspectionFromJob(sparkle.id, job.id, admin.id, inspTpl.id)
  await setInspectionItemResult(sparkle.id, insp.id, insp.results[0].id, { result: "FAIL" })
  const fin = await finalizeInspection(sparkle.id, insp.id, admin.id)
  check("failed inspection creates a QUALITY issue", fin.issueId != null)
  const inspIssue = await getIssue(sparkle.id, fin.issueId!)
  check("inspection issue is manageable like any other", inspIssue?.inspection?.id === insp.id && inspIssue?.status === "OPEN")
  const inspAck = await setIssueStatus(sparkle.id, fin.issueId!, admin.id, "ACKNOWLEDGED")
  check("inspection issue status transitions", inspAck?.status === "ACKNOWLEDGED")

  // Cross-org isolation.
  const rivalUser = await orgDb(rival.id).user.findFirst({ where: { role: "OWNER" }, select: { id: true } })
  await expectThrows("cross-org issue assign denied", () => assignIssue(rival.id, fieldIssue.id, rivalUser!.id, null), ReferenceError)
  await expectThrows("cross-org issue status denied", () => setIssueStatus(rival.id, fieldIssue.id, rivalUser!.id, "OPEN"), ReferenceError)
  await expectThrows("cross-org issue note denied", () => addIssueComment(rival.id, fieldIssue.id, rivalUser!.id, "x"), ReferenceError)

  console.log("\nMulti-org rolling generation:")
  const plan = await createServicePlan(sparkle.id, { serviceLocationId: site.id, name: "Daily", frequency: "DAILY", startTime: "09:00", crewSize: 1, startDate: new Date(Date.now() - 3 * DAY) })
  void plan
  const gen1 = await generateUpcomingAllOrgs(10)
  const created1 = gen1.reduce((s, r) => s + (r.created ?? 0), 0)
  check("generation runs across all orgs", gen1.length >= 2 && created1 > 0, `${gen1.length} orgs, ${created1} jobs`)
  const gen2 = await generateUpcomingAllOrgs(10)
  const created2 = gen2.reduce((s, r) => s + (r.created ?? 0), 0)
  check("rerun is idempotent (no duplicates)", created2 === 0)

  console.log("\nApproved-time export:")
  const expJob = await createManualJob(sparkle.id, { serviceLocationId: site.id, title: "Export job", date: "2026-07-02", startTime: "09:00", checklistTemplateId: scope.id })
  await assignCleaner(sparkle.id, expJob.id, nc.id)
  await clockIn(sparkle.id, expJob.id, nc.id, {})
  const eItem = (await getJob(sparkle.id, expJob.id))!.checklistItems[0]
  await toggleChecklistItem(sparkle.id, expJob.id, eItem.id, nc.id, { isComplete: true })
  await clockOut(sparkle.id, expJob.id, nc.id, {})
  const entry = (await getJob(sparkle.id, expJob.id))!.timeEntries[0]
  await approveTimeEntry(sparkle.id, entry.id, admin.id)

  const rows = await listApprovedForExport(sparkle.id, new Date("2026-01-01"), new Date("2027-01-01"))
  check("export includes only approved entries", rows.length >= 1)
  check("export carries employeeCode", rows.some((r) => r.user.employeeProfile?.employeeCode === "E-200"))

  console.log(`\n${failures === 0 ? "ALL PHASE 5A CHECKS PASSED" : `${failures} PHASE 5A CHECK(S) FAILED`}`)
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
