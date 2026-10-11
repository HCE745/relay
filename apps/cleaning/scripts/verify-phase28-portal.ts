// Phase 28 integration verification: portal self-service & feedback.
//  - a portal reschedule/cancel request is created PENDING (no schedule mutation)
//    and staff approval performs the real reschedule/cancel
//  - a customer can approve/decline a shared quote (estimate)
//  - a post-service survey records a rating once per completed job and rolls up
//    per site and per cleaner
//  - ownership is enforced (another customer can't act on your job/quote)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase28-portal.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createServiceRequest, reviewServiceRequest } from "../src/lib/data/service-requests"
import { listPortalQuotes, portalDecideQuote } from "../src/lib/data/portal-quotes"
import { submitSurvey, listSurveyableJobs, getSatisfactionReport } from "../src/lib/data/surveys"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Portal Co", slug: `po-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleo", email: `c-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const other = await systemDb.customer.create({ data: { organizationId: org.id, name: "Other" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })

  console.log("Reschedule request → staff approval reschedules the job:")
  const soon = new Date(Date.UTC(2026, 6, 1, 13))
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Weekly", status: "SCHEDULED", scheduledStart: soon, plannedStart: soon }, select: { id: true } })
  const req = await createServiceRequest(org.id, cust.id, { jobId: job.id, type: "RESCHEDULE", requestedDate: "2026-07-02", requestedTime: "09:00", note: "morning please" })
  check("request created PENDING", req.status === "PENDING")
  const stillSame = await systemDb.job.findUniqueOrThrow({ where: { id: job.id } })
  check("job NOT moved yet (request only)", stillSame.scheduledStart.getTime() === soon.getTime())
  check("another customer can't request on this job", (await threw(() => createServiceRequest(org.id, other.id, { jobId: job.id, type: "CANCEL" }))) !== null)
  await reviewServiceRequest(org.id, req.id, true, mgr.id)
  const moved = await systemDb.job.findUniqueOrThrow({ where: { id: job.id } })
  check("approval rescheduled the job to the requested time", moved.scheduledStart.toISOString().startsWith("2026-07-02T09:00"))

  console.log("\nCancel request → approval cancels:")
  const job2 = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Extra", status: "SCHEDULED", scheduledStart: new Date(Date.UTC(2026, 6, 3, 13)), plannedStart: new Date(Date.UTC(2026, 6, 3, 13)) }, select: { id: true } })
  const req2 = await createServiceRequest(org.id, cust.id, { jobId: job2.id, type: "CANCEL" })
  await reviewServiceRequest(org.id, req2.id, true, mgr.id)
  check("approved cancel set the job CANCELLED", (await systemDb.job.findUniqueOrThrow({ where: { id: job2.id } })).status === "CANCELLED")

  console.log("\nPortal quote approval:")
  const est = await systemDb.estimate.create({ data: { organizationId: org.id, customerId: cust.id, title: "Monthly deep clean", status: "SENT", currency: "USD", subtotal: "500.00", total: "500.00" }, select: { id: true } })
  check("quote listed for the customer", (await listPortalQuotes(org.id, cust.id)).some((q) => q.id === est.id))
  check("another customer can't decide it", (await threw(() => portalDecideQuote(org.id, other.id, est.id, "APPROVED"))) !== null)
  await portalDecideQuote(org.id, cust.id, est.id, "APPROVED")
  check("approved quote → estimate ACCEPTED", (await systemDb.estimate.findUniqueOrThrow({ where: { id: est.id } })).status === "ACCEPTED")

  console.log("\nSatisfaction survey (once per job; rolls up per site + cleaner):")
  const doneJob = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Done", status: "COMPLETED", scheduledStart: new Date(Date.UTC(2026, 5, 20, 13)), actualEnd: new Date(Date.UTC(2026, 5, 20, 15)), assignments: { create: [{ organizationId: org.id, userId: cleaner.id, status: "COMPLETED" }] } }, select: { id: true } })
  check("surveyable before rating", (await listSurveyableJobs(org.id, cust.id)).some((j) => j.id === doneJob.id))
  await submitSurvey(org.id, cust.id, doneJob.id, 5, "Excellent")
  check("rating a job twice is refused", (await threw(() => submitSurvey(org.id, cust.id, doneJob.id, 3))) !== null)
  check("no longer surveyable after rating", !(await listSurveyableJobs(org.id, cust.id)).some((j) => j.id === doneJob.id))
  const report = await getSatisfactionReport(org.id)
  check("report rolls up by site and cleaner", report.overall === 5 && report.bySite.some((s) => s.name === "HQ" && s.avg === 5) && report.byCleaner.some((c) => c.name === "Cleo" && c.avg === 5))

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PORTAL/FEEDBACK CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
