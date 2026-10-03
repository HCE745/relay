import { orgDb } from "../org-db"
import { dateKeyInZone } from "../scheduling/time"

// Cleaner unavailability windows (Phase 11). Dates are calendar dates stored at
// UTC midnight; membership is by calendar day.

const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`)
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export function listUnavailability(orgId: string, opts: { userId?: string; from?: Date } = {}) {
  return orgDb(orgId).availability.findMany({
    where: { ...(opts.userId ? { userId: opts.userId } : {}), ...(opts.from ? { endDate: { gte: opts.from } } : {}) },
    orderBy: { startDate: "asc" },
    include: { user: { select: { id: true, name: true } } },
  })
}

export function createUnavailability(
  orgId: string,
  input: { userId: string; startDate: string; endDate: string; reason?: string },
  createdById: string,
  source: "MANAGER" | "TIME_OFF" = "MANAGER",
) {
  return orgDb(orgId).availability.create({
    data: {
      organizationId: orgId,
      userId: input.userId,
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      reason: input.reason,
      source,
      createdById,
    },
  })
}

export async function deleteUnavailability(orgId: string, id: string) {
  const { count } = await orgDb(orgId).availability.deleteMany({ where: { id } })
  return count > 0
}

/** True when a user is unavailable on `instant`'s calendar day in `tz`. */
export function isUnavailableOn(
  blocks: { userId: string; startDate: Date; endDate: Date }[],
  userId: string,
  instant: Date,
  tz: string,
): boolean {
  const key = dateKeyInZone(instant, tz)
  return blocks.some((b) => b.userId === userId && dayKey(b.startDate) <= key && key <= dayKey(b.endDate))
}
