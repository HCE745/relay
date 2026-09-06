import { orgDb } from "../org-db"

// Management Time view. Trustworthy labor/time data for later approval/export.
// NOT payroll — no tax or pay calculation here.
export function listTimeEntries(orgId: string, start: Date, end: Date) {
  return orgDb(orgId).timeEntry.findMany({
    where: { clockInAt: { gte: start, lte: end } },
    orderBy: { clockInAt: "desc" },
    include: {
      user: { select: { name: true } },
      job: {
        select: {
          id: true,
          title: true,
          serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } },
        },
      },
    },
  })
}
