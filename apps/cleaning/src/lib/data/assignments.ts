import { orgDb, isUniqueViolation } from "../org-db"
import { assertFound } from "./errors"

// Cleaner ↔ Job assignment management. Validates that both the Job and the
// cleaner belong to the authenticated org and that the cleaner is an active
// worker. Obvious time overlaps are surfaced as a WARNING, never blocked —
// availability optimization is out of scope.

export type Conflict = { jobId: string; title: string; start: Date }
export type AssignResult = { assigned: boolean; alreadyAssigned: boolean; conflicts: Conflict[] }

export function listAssignableCleaners(orgId: string) {
  return orgDb(orgId).user.findMany({
    where: { role: "CLEANER", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

const HOUR = 60 * 60 * 1000

export async function assignCleaner(orgId: string, jobId: string, userId: string): Promise<AssignResult> {
  const db = orgDb(orgId)

  const job = await db.job.findFirst({
    where: { id: jobId },
    select: { id: true, status: true, scheduledStart: true, scheduledEnd: true },
  })
  assertFound(job, "Job")
  // Cleaner must belong to this org and be an active CLEANER.
  const cleaner = await db.user.findFirst({
    where: { id: userId, role: "CLEANER", isActive: true },
    select: { id: true },
  })
  assertFound(cleaner, "Active cleaner")

  const start = job!.scheduledStart
  const end = job!.scheduledEnd ?? new Date(start.getTime() + HOUR)

  // Best-effort overlap warning against this cleaner's other (non-cancelled) jobs.
  const nearby = await db.jobAssignment.findMany({
    where: {
      userId,
      jobId: { not: jobId },
      job: { status: { not: "CANCELLED" }, scheduledStart: { gte: new Date(start.getTime() - 12 * HOUR), lt: end } },
    },
    include: { job: { select: { id: true, title: true, scheduledStart: true, scheduledEnd: true } } },
  })
  const conflicts: Conflict[] = nearby
    .filter((a) => {
      const os = a.job.scheduledStart
      const oe = a.job.scheduledEnd ?? new Date(os.getTime() + HOUR)
      return os < end && oe > start
    })
    .map((a) => ({ jobId: a.job.id, title: a.job.title, start: a.job.scheduledStart }))

  try {
    await db.jobAssignment.create({ data: { organizationId: orgId, jobId, userId, status: "ASSIGNED" } })
  } catch (e) {
    if (isUniqueViolation(e)) return { assigned: false, alreadyAssigned: true, conflicts }
    throw e
  }

  // Advance SCHEDULED → ASSIGNED (never touch IN_PROGRESS/COMPLETED/etc.).
  await db.job.updateMany({ where: { id: jobId, status: "SCHEDULED" }, data: { status: "ASSIGNED" } })
  return { assigned: true, alreadyAssigned: false, conflicts }
}

export async function removeAssignment(orgId: string, jobId: string, userId: string): Promise<boolean> {
  const db = orgDb(orgId)
  // Confirm the job is in this org before mutating assignments.
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  if (!job) return false

  const { count } = await db.jobAssignment.deleteMany({ where: { jobId, userId } })
  if (count === 0) return false

  // If the job now has no assignees and was ASSIGNED, revert it to SCHEDULED.
  const remaining = await db.jobAssignment.count({ where: { jobId } })
  if (remaining === 0) {
    await db.job.updateMany({ where: { id: jobId, status: "ASSIGNED" }, data: { status: "SCHEDULED" } })
  }
  return true
}
