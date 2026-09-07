import { orgDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { recordAudit } from "./audit"

// Management Time: review, approve/reapprove, correct (audited), export. NOT
// payroll — no tax/pay calculation. Durations are derived from timestamps, so a
// correction recalculates duration everywhere automatically.

const timeInclude = {
  user: { select: { id: true, name: true } },
  approvedBy: { select: { name: true } },
  job: {
    select: {
      id: true,
      title: true,
      serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } },
    },
  },
} as const

export function listTimeEntries(orgId: string, start: Date, end: Date) {
  return orgDb(orgId).timeEntry.findMany({
    where: { clockInAt: { gte: start, lte: end } },
    orderBy: { clockInAt: "desc" },
    include: timeInclude,
  })
}

export async function approveTimeEntry(orgId: string, entryId: string, approverId: string) {
  const db = orgDb(orgId)
  const e = await db.timeEntry.findFirst({ where: { id: entryId }, select: { id: true, status: true, clockOutAt: true } })
  assertFound(e, "Time entry")
  if (e!.status === "OPEN" || e!.clockOutAt == null) throw new ConflictError("Cannot approve an open time entry")
  if (e!.status === "APPROVED") return { alreadyApproved: true }
  await db.timeEntry.updateMany({
    where: { id: entryId },
    data: { status: "APPROVED", approvedById: approverId, approvedAt: new Date() },
  })
  await recordAudit(orgId, approverId, "TimeEntry", entryId, "approve")
  return { alreadyApproved: false }
}

export async function correctTimeEntry(
  orgId: string,
  entryId: string,
  actorId: string,
  input: { clockInAt?: Date; clockOutAt?: Date; reason: string },
) {
  const db = orgDb(orgId)
  const e = await db.timeEntry.findFirst({ where: { id: entryId } })
  assertFound(e, "Time entry")

  const newIn = input.clockInAt ?? e!.clockInAt
  const newOut = input.clockOutAt ?? e!.clockOutAt
  if (newOut && newIn >= newOut) throw new ConflictError("Clock-out must be after clock-in")

  // Editing an APPROVED entry removes approval and requires re-approval.
  const wasApproved = e!.status === "APPROVED"
  const data: Record<string, unknown> = { clockInAt: newIn, clockOutAt: newOut }
  if (wasApproved) {
    data.status = "COMPLETED"
    data.approvedById = null
    data.approvedAt = null
  }
  await db.timeEntry.updateMany({ where: { id: entryId }, data })
  await recordAudit(orgId, actorId, "TimeEntry", entryId, "correct", {
    metadata: {
      reason: input.reason,
      old: { clockInAt: e!.clockInAt, clockOutAt: e!.clockOutAt },
      new: { clockInAt: newIn, clockOutAt: newOut },
      approvalCleared: wasApproved,
    },
  })
  return db.timeEntry.findFirst({ where: { id: entryId }, include: timeInclude })
}

/** Approved entries only, tenant-scoped — the raw labor data for CSV export. */
export function listApprovedForExport(orgId: string, start: Date, end: Date) {
  return orgDb(orgId).timeEntry.findMany({
    where: { status: "APPROVED", clockInAt: { gte: start, lte: end } },
    orderBy: { clockInAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      job: {
        select: {
          id: true,
          serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } },
        },
      },
    },
  })
}
