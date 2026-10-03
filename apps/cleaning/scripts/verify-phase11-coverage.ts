// Phase 11 integration verification. Focus: a job assigned to an unavailable
// cleaner shows as uncovered within the 48h window (and not beyond it); the
// coverage finder returns available, non-busy cleaners ranked by prior work at
// the site; reassign moves the assignment, logs an AuditEvent and clears the
// gap; and an approved time-off request creates an unavailability that drives
// coverage.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase11-coverage.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { listUncoveredShifts, findCoverageCandidates, reassignJob } from "../src/lib/data/coverage"
import { createUnavailability } from "../src/lib/data/availability"
import { requestTimeOff, listTimeOff, reviewTimeOff } from "../src/lib/data/timeoff"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Coverage Test", slug: `cov-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ", timezone: "UTC" } })
  const mkCleaner = (name: string) => systemDb.user.create({ data: { organizationId: org.id, name, email: `${name.toLowerCase()}-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const A = await mkCleaner("Alice")
  const B = await mkCleaner("Bob")
  const C = await mkCleaner("Cara")

  const mkJob = async (title: string, startIso: string, status: string, assignee?: string) => {
    const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title, status: status as "SCHEDULED", scheduledStart: new Date(startIso), scheduledEnd: new Date(new Date(startIso).getTime() + 2 * 3600_000) } })
    if (assignee) await systemDb.jobAssignment.create({ data: { organizationId: org.id, jobId: job.id, userId: assignee } })
    return job
  }

  const now = new Date("2026-05-01T08:00:00Z")
  // Prior completed job at the site for Bob → ranks him first.
  await mkJob("Past clean", "2026-04-01T14:00:00Z", "COMPLETED", B.id)
  const job1 = await mkJob("Nightly — needs cover", "2026-05-01T14:00:00Z", "SCHEDULED", A.id)
  await mkJob("Parallel job (Cara busy)", "2026-05-01T14:00:00Z", "SCHEDULED", C.id)
  const jobFar = await mkJob("Beyond 48h", "2026-05-05T14:00:00Z", "SCHEDULED", A.id)

  // Alice unavailable across both the near and far jobs; Cara unavailable far.
  await createUnavailability(org.id, { userId: A.id, startDate: "2026-05-01", endDate: "2026-05-06" }, A.id)

  console.log("Uncovered shifts are flagged within 48h, and only within 48h:")
  const shifts = await listUncoveredShifts(org.id, { hoursAhead: 48, now })
  check("the job on the unavailable cleaner is uncovered", shifts.some((s) => s.jobId === job1.id))
  check("the parallel job with an available cleaner is NOT uncovered", !shifts.some((s) => s.title.includes("Parallel")))
  check("a job beyond the 48h window is NOT listed (even though its cleaner is off)", !shifts.some((s) => s.jobId === jobFar.id))

  console.log("Coverage finder returns available, non-busy cleaners ranked by prior work at the site:")
  const cands = await findCoverageCandidates(org.id, job1.id)
  const ids = cands.map((c) => c.userId)
  check("excludes the unavailable/assigned cleaner (Alice)", !ids.includes(A.id))
  check("excludes the busy cleaner (Cara, on a parallel job)", !ids.includes(C.id))
  check("includes the available cleaner (Bob)", ids.includes(B.id))
  check("Bob ranks by prior jobs at this site (=1)", cands.find((c) => c.userId === B.id)?.priorJobsAtSite === 1)

  console.log("Reassign moves the assignment, logs an AuditEvent, clears the gap:")
  await reassignJob(org.id, job1.id, { fromUserId: A.id, toUserId: B.id }, A.id)
  const assignees = await systemDb.jobAssignment.findMany({ where: { jobId: job1.id }, select: { userId: true } })
  check("Alice removed, Bob assigned", assignees.length === 1 && assignees[0].userId === B.id)
  const audit = await systemDb.auditEvent.findFirst({ where: { organizationId: org.id, entityType: "Job", entityId: job1.id, action: "reassign" } })
  check("an AuditEvent recorded the reassign", !!audit && audit.oldValue === A.id && audit.newValue === B.id)
  const afterShifts = await listUncoveredShifts(org.id, { hoursAhead: 48, now })
  check("the job is covered after reassignment", !afterShifts.some((s) => s.jobId === job1.id))

  console.log("Approved time off creates an unavailability that drives coverage:")
  const job3 = await mkJob("Day-2 job for Bob", "2026-05-02T14:00:00Z", "SCHEDULED", B.id)
  const beforeReq = await listUncoveredShifts(org.id, { hoursAhead: 48, now })
  check("Bob's day-2 job is covered before any time off", !beforeReq.some((s) => s.jobId === job3.id))
  const req = await requestTimeOff(org.id, B.id, { startDate: "2026-05-02", endDate: "2026-05-02", reason: "Doctor" })
  const pending = await listTimeOff(org.id, { status: "PENDING" })
  check("request is PENDING and listed", pending.some((p) => p.id === req.id))
  await reviewTimeOff(org.id, req.id, { approve: true, reviewerId: A.id })
  const block = await systemDb.availability.findFirst({ where: { userId: B.id, source: "TIME_OFF" } })
  check("approval created a TIME_OFF unavailability block", !!block)
  const afterApprove = await listUncoveredShifts(org.id, { hoursAhead: 48, now })
  check("Bob's day-2 job is now uncovered", afterApprove.some((s) => s.jobId === job3.id))
  const denied = await reviewTimeOff(org.id, req.id, { approve: false, reviewerId: A.id })
  check("re-reviewing an already-decided request is a no-op (stays APPROVED)", denied?.status === "APPROVED")

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL COVERAGE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
