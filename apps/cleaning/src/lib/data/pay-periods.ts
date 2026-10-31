import { orgDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { recordAudit } from "./audit"
import { startOfUtcDay, endOfUtcDay } from "../billing-math"

// Payroll period locking (Phase 41). A LOCKED period freezes everything whose
// work date falls inside it: time entries can't be approved or corrected, and
// commission earnings are not recomputed. This protects a payroll period after
// it has been exported. Only OWNER/ADMIN may unlock (enforced at the route),
// and every lock/unlock is audited; an unlock requires a reason.

export async function listPayPeriods(orgId: string) {
  const periods = await orgDb(orgId).payPeriod.findMany({
    orderBy: { start: "desc" },
    include: { lockedBy: { select: { name: true } }, _count: { select: { exportRuns: true } } },
  })
  return periods.map((p) => ({
    id: p.id,
    start: p.start,
    end: p.end,
    status: p.status,
    lockedByName: p.lockedBy?.name ?? null,
    lockedAt: p.lockedAt,
    exportCount: p._count.exportRuns,
  }))
}

/** Create a pay period from inclusive yyyy-mm-dd bounds; rejects any overlap. */
export async function createPayPeriod(orgId: string, input: { start: string; end: string }) {
  const start = startOfUtcDay(input.start)
  const end = endOfUtcDay(input.end)
  if (end <= start) throw new ConflictError("The period end must be on or after the start")
  const db = orgDb(orgId)
  // Overlap = an existing period whose range intersects [start, end].
  const clash = await db.payPeriod.findFirst({ where: { start: { lte: end }, end: { gte: start } }, select: { id: true } })
  if (clash) throw new ConflictError("That range overlaps an existing pay period")
  return db.payPeriod.create({ data: { organizationId: orgId, start, end } })
}

export async function lockPeriod(orgId: string, periodId: string, actorId: string) {
  const db = orgDb(orgId)
  const p = await db.payPeriod.findFirst({ where: { id: periodId }, select: { id: true, status: true } })
  assertFound(p, "Pay period")
  if (p!.status === "LOCKED") return { alreadyLocked: true }
  await db.payPeriod.updateMany({ where: { id: periodId }, data: { status: "LOCKED", lockedById: actorId, lockedAt: new Date() } })
  await recordAudit(orgId, actorId, "PayPeriod", periodId, "lock")
  return { alreadyLocked: false }
}

export async function unlockPeriod(orgId: string, periodId: string, actorId: string, reason: string) {
  const db = orgDb(orgId)
  const p = await db.payPeriod.findFirst({ where: { id: periodId }, select: { id: true, status: true } })
  assertFound(p, "Pay period")
  if (!reason.trim()) throw new ConflictError("A reason is required to unlock a pay period")
  if (p!.status === "OPEN") return { alreadyOpen: true }
  await db.payPeriod.updateMany({ where: { id: periodId }, data: { status: "OPEN", lockedById: null, lockedAt: null } })
  await recordAudit(orgId, actorId, "PayPeriod", periodId, "unlock", { metadata: { reason } })
  return { alreadyOpen: false }
}

/** True if a LOCKED period covers this instant. Used to freeze pay/commission. */
export async function isDateLocked(orgId: string, date: Date): Promise<boolean> {
  const hit = await orgDb(orgId).payPeriod.findFirst({
    where: { status: "LOCKED", start: { lte: date }, end: { gte: date } },
    select: { id: true },
  })
  return !!hit
}

/** Throws if the instant falls in a LOCKED period — the edit guard for time. */
export async function assertDateUnlocked(orgId: string, date: Date): Promise<void> {
  if (await isDateLocked(orgId, date)) {
    throw new ConflictError("This pay period is locked. An owner or admin must unlock it before editing time in it.")
  }
}

/** Find the exact period for a range, if one exists (used to attach an export). */
export async function findPeriodForRange(orgId: string, startISO: string, endISO: string) {
  const start = startOfUtcDay(startISO)
  const end = endOfUtcDay(endISO)
  return orgDb(orgId).payPeriod.findFirst({ where: { start, end }, select: { id: true, status: true } })
}
