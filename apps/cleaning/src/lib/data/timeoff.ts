import { orgDb } from "../org-db"

const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`)

export function listTimeOff(orgId: string, opts: { status?: string; userId?: string } = {}) {
  return orgDb(orgId).timeOffRequest.findMany({
    where: { ...(opts.status ? { status: opts.status as "PENDING" | "APPROVED" | "DENIED" } : {}), ...(opts.userId ? { userId: opts.userId } : {}) },
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: { user: { select: { id: true, name: true } } },
  })
}

export function requestTimeOff(orgId: string, userId: string, input: { startDate: string; endDate: string; reason?: string }) {
  return orgDb(orgId).timeOffRequest.create({
    data: { organizationId: orgId, userId, startDate: toDate(input.startDate), endDate: toDate(input.endDate), reason: input.reason, status: "PENDING" },
  })
}

/**
 * Approve or deny a pending request. Approving creates a matching unavailability
 * block (source TIME_OFF) atomically so the cleaner's time off immediately
 * drives coverage flags.
 */
export async function reviewTimeOff(orgId: string, id: string, opts: { approve: boolean; reviewerId: string }) {
  const db = orgDb(orgId)
  const req = await db.timeOffRequest.findFirst({ where: { id }, select: { id: true, userId: true, startDate: true, endDate: true, reason: true, status: true } })
  if (!req) return null
  if (req.status !== "PENDING") return req

  if (opts.approve) {
    await db.$transaction(async (tx) => {
      await tx.timeOffRequest.updateMany({ where: { id }, data: { status: "APPROVED", reviewedById: opts.reviewerId, reviewedAt: new Date() } })
      await tx.availability.create({
        data: {
          organizationId: orgId,
          userId: req.userId,
          startDate: req.startDate,
          endDate: req.endDate,
          reason: req.reason ?? "Approved time off",
          source: "TIME_OFF",
          createdById: opts.reviewerId,
        },
      })
    })
  } else {
    await db.timeOffRequest.updateMany({ where: { id }, data: { status: "DENIED", reviewedById: opts.reviewerId, reviewedAt: new Date() } })
  }
  return db.timeOffRequest.findFirst({ where: { id } })
}
