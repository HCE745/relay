import { orgDb } from "../org-db"

// Cleaner field queries. Everything is constrained to jobs the authenticated
// cleaner is actually assigned to — the org-scoped client plus the
// `assignments: { some: { userId } }` filter make cross-assignment access
// impossible.

export async function listCleanerDayJobs(orgId: string, userId: string, dayStart: Date, dayEnd: Date) {
  return orgDb(orgId).job.findMany({
    where: {
      status: { not: "CANCELLED" },
      assignments: { some: { userId } },
      OR: [{ scheduledStart: { gte: dayStart, lte: dayEnd } }, { status: "IN_PROGRESS" }],
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      serviceLocation: {
        select: {
          name: true,
          timezone: true,
          addressLine1: true,
          city: true,
          state: true,
          customer: { select: { name: true } },
        },
      },
      checklistItems: { select: { isRequired: true, isComplete: true } },
      timeEntries: { where: { userId, status: "OPEN" }, select: { id: true } },
    },
  })
}

export function getFieldJob(orgId: string, userId: string, jobId: string) {
  return orgDb(orgId).job.findFirst({
    where: { id: jobId, assignments: { some: { userId } } },
    include: {
      serviceLocation: {
        select: {
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          timezone: true,
          notes: true,
          customer: { select: { name: true } },
        },
      },
      servicePlan: { select: { name: true } },
      checklistItems: { orderBy: { sortOrder: "asc" }, include: { photos: { select: { id: true } } } },
      timeEntries: { where: { userId }, orderBy: { clockInAt: "desc" } },
      photos: { select: { id: true, jobChecklistItemId: true, caption: true } },
      issues: { orderBy: { createdAt: "desc" }, select: { id: true, category: true, description: true, createdAt: true } },
    },
  })
}
