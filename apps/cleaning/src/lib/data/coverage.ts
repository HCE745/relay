import { orgDb } from "../org-db"
import { getOrgTimezone } from "./org"
import { isUnavailableOn } from "./availability"
import { assertFound, ReferenceError } from "./errors"

// Shift coverage (Phase 11). An assignment on an unavailable cleaner's job needs
// coverage; the finder ranks available cleaners by prior work at the site; a
// reassign is one write + an AuditEvent.

const ACTIVE_JOB_STATUSES = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] as const
const endOf = (start: Date, end: Date | null) => end ?? new Date(start.getTime() + 60 * 60 * 1000)

export type UncoveredShift = {
  jobId: string
  title: string
  scheduledStart: Date
  siteName: string
  customerName: string
  unavailable: { userId: string; name: string }[]
}

export async function listUncoveredShifts(orgId: string, opts: { hoursAhead?: number; now?: Date } = {}): Promise<UncoveredShift[]> {
  const now = opts.now ?? new Date()
  const windowEnd = new Date(now.getTime() + (opts.hoursAhead ?? 48) * 3600_000)
  const tz = await getOrgTimezone(orgId)

  const jobs = await orgDb(orgId).job.findMany({
    where: { status: { in: [...ACTIVE_JOB_STATUSES] }, scheduledStart: { gte: now, lte: windowEnd } },
    orderBy: { scheduledStart: "asc" },
    include: {
      serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  const userIds = [...new Set(jobs.flatMap((j) => j.assignments.map((a) => a.userId)))]
  if (userIds.length === 0) return []
  const blocks = await orgDb(orgId).availability.findMany({
    where: { userId: { in: userIds }, endDate: { gte: now } },
    select: { userId: true, startDate: true, endDate: true },
  })

  const out: UncoveredShift[] = []
  for (const job of jobs) {
    const siteTz = job.serviceLocation.timezone ?? tz
    const unavailable = job.assignments
      .filter((a) => isUnavailableOn(blocks, a.userId, job.scheduledStart, siteTz))
      .map((a) => ({ userId: a.userId, name: a.user.name }))
    if (unavailable.length > 0) {
      out.push({
        jobId: job.id,
        title: job.title,
        scheduledStart: job.scheduledStart,
        siteName: job.serviceLocation.name,
        customerName: job.serviceLocation.customer.name,
        unavailable,
      })
    }
  }
  return out
}

export async function countUncoveredShifts(orgId: string, opts: { hoursAhead?: number; now?: Date } = {}): Promise<number> {
  return (await listUncoveredShifts(orgId, opts)).length
}

export type CoverageCandidate = { userId: string; name: string; priorJobsAtSite: number }

/** Available cleaners who aren't busy at that time, ranked by prior work at the site. */
export async function findCoverageCandidates(orgId: string, jobId: string): Promise<CoverageCandidate[]> {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId },
    select: {
      id: true, scheduledStart: true, scheduledEnd: true, serviceLocationId: true,
      serviceLocation: { select: { timezone: true } },
      assignments: { select: { userId: true } },
    },
  })
  assertFound(job, "Job")
  const tz = (await getOrgTimezone(orgId))
  const siteTz = job!.serviceLocation.timezone ?? tz
  const targetStart = job!.scheduledStart
  const targetEnd = endOf(job!.scheduledStart, job!.scheduledEnd)
  const alreadyOnJob = new Set(job!.assignments.map((a) => a.userId))

  // Candidate pool: active field staff.
  const pool = await db.user.findMany({
    where: { isActive: true, role: { in: ["CLEANER", "SUPERVISOR"] } },
    select: { id: true, name: true },
  })
  const poolIds = pool.map((u) => u.id)
  if (poolIds.length === 0) return []

  // Unavailability blocks for the pool covering the job date.
  const blocks = await db.availability.findMany({
    where: { userId: { in: poolIds }, startDate: { lte: targetEnd }, endDate: { gte: targetStart } },
    select: { userId: true, startDate: true, endDate: true },
  })

  // Busy = assigned to another active job overlapping the target window.
  const nearby = await db.job.findMany({
    where: {
      id: { not: jobId },
      status: { in: [...ACTIVE_JOB_STATUSES] },
      scheduledStart: { gte: new Date(targetStart.getTime() - 24 * 3600_000), lt: targetEnd },
    },
    select: { scheduledStart: true, scheduledEnd: true, assignments: { select: { userId: true } } },
  })
  const busy = new Set<string>()
  for (const nj of nearby) {
    if (endOf(nj.scheduledStart, nj.scheduledEnd) > targetStart && nj.scheduledStart < targetEnd) {
      for (const a of nj.assignments) busy.add(a.userId)
    }
  }

  // Prior work at THIS site (completed jobs the candidate was assigned to).
  const priorRows = await db.jobAssignment.groupBy({
    by: ["userId"],
    where: { userId: { in: poolIds }, job: { serviceLocationId: job!.serviceLocationId, status: "COMPLETED" } },
    _count: { _all: true },
  })
  const prior = new Map(priorRows.map((r) => [r.userId, r._count._all]))

  return pool
    .filter((u) => !alreadyOnJob.has(u.id))
    .filter((u) => !isUnavailableOn(blocks, u.id, targetStart, siteTz))
    .filter((u) => !busy.has(u.id))
    .map((u) => ({ userId: u.id, name: u.name, priorJobsAtSite: prior.get(u.id) ?? 0 }))
    .sort((a, b) => b.priorJobsAtSite - a.priorJobsAtSite || a.name.localeCompare(b.name))
}

/** Reassign a job from one cleaner to another; logged to AuditEvent. */
export async function reassignJob(
  orgId: string,
  jobId: string,
  input: { fromUserId?: string; toUserId: string },
  actorUserId: string,
) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")
  const toUser = await db.user.findFirst({ where: { id: input.toUserId, isActive: true }, select: { id: true } })
  if (!toUser) throw new ReferenceError("The selected cleaner is not available to assign")

  await db.$transaction(async (tx) => {
    if (input.fromUserId) await tx.jobAssignment.deleteMany({ where: { jobId, userId: input.fromUserId } })
    const exists = await tx.jobAssignment.findFirst({ where: { jobId, userId: input.toUserId }, select: { id: true } })
    if (!exists) await tx.jobAssignment.create({ data: { organizationId: orgId, jobId, userId: input.toUserId } })
    await tx.auditEvent.create({
      data: {
        organizationId: orgId,
        actorUserId,
        entityType: "Job",
        entityId: jobId,
        action: "reassign",
        oldValue: input.fromUserId ?? null,
        newValue: input.toUserId,
        metadata: { reason: "coverage" },
      },
    })
  })
  return { ok: true }
}
