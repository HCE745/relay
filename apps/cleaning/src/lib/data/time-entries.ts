import { orgDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { recordAudit } from "./audit"
import { assertDateUnlocked } from "./pay-periods"
import { activeDifferentialRules } from "./shift-differentials"
import { getOrgTimezone } from "./org"
import { computeDifferential } from "../shift-differentials"

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
  const e = await db.timeEntry.findFirst({
    where: { id: entryId },
    select: {
      id: true, status: true, clockInAt: true, clockOutAt: true, breakMinutes: true, userId: true,
      job: { select: { serviceLocation: { select: { timezone: true } } } },
    },
  })
  assertFound(e, "Time entry")
  if (e!.status === "OPEN" || e!.clockOutAt == null) throw new ConflictError("Cannot approve an open time entry")
  if (e!.status === "APPROVED") return { alreadyApproved: true }
  await assertDateUnlocked(orgId, e!.clockInAt) // Phase 41: no approvals in a locked period
  // Snapshot the worker's pay basis at approval so a later raise never rewrites
  // this entry's historical labor cost (same pattern as invoice-line snapshots).
  const worker = await db.user.findFirst({
    where: { id: e!.userId },
    select: { employeeProfile: { select: { payRate: true, payType: true } } },
  })
  // Phase 43: snapshot the shift-differential premium earned on this entry. Hourly
  // only (salaried time has no hourly base to premium); cost/export only.
  const payType = worker?.employeeProfile?.payType ?? null
  const payRate = worker?.employeeProfile?.payRate ?? null
  let differential = null as Awaited<ReturnType<typeof computeDifferential>> | null
  if (payType !== "SALARY") {
    const rules = await activeDifferentialRules(orgId)
    if (rules.length) {
      const tz = e!.job?.serviceLocation?.timezone ?? (await getOrgTimezone(orgId))
      differential = computeDifferential({ clockInAt: e!.clockInAt, clockOutAt: e!.clockOutAt, breakMinutes: e!.breakMinutes }, payRate, tz, rules)
    }
  }
  await db.timeEntry.updateMany({
    where: { id: entryId },
    data: {
      status: "APPROVED",
      approvedById: approverId,
      approvedAt: new Date(),
      approvedPayRate: payRate,
      approvedPayType: payType,
      approvedDifferential: differential && differential.amount.greaterThan(0) ? differential.amount : null,
      approvedDifferentialNote: differential && differential.note ? differential.note : null,
    },
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
  // Phase 41: can't correct into or out of a locked period (check both dates).
  await assertDateUnlocked(orgId, e!.clockInAt)
  await assertDateUnlocked(orgId, newIn)

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
      user: { select: { id: true, name: true, employeeProfile: { select: { employeeCode: true } } } },
      job: {
        select: {
          id: true,
          serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } },
        },
      },
    },
  })
}
