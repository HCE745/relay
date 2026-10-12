import { orgDb } from "../org-db"

// Issue resolution dashboard (Phase 33). Reuses the existing issue data — no new
// storage — to surface the operational health of the issue queue: what's open,
// what's late, who owns what, and how fast things actually get resolved. Tiles
// link through to the filtered issue list.

const OPEN_STATUSES: ("OPEN" | "ACKNOWLEDGED")[] = ["OPEN", "ACKNOWLEDGED"]
const DAY = 86_400_000

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000
}
function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export async function getIssueResolutionStats(orgId: string, now: Date = new Date()) {
  const db = orgDb(orgId)
  const since30 = new Date(now.getTime() - 30 * DAY)
  const since7 = new Date(now.getTime() - 7 * DAY)

  const [open, unassigned, overdue, awaitingVerification, escalated, closed7, reopenedOpen] = await Promise.all([
    db.issue.count({ where: { status: { in: OPEN_STATUSES } } }),
    db.issue.count({ where: { status: { in: OPEN_STATUSES }, assignedToId: null } }),
    db.issue.count({ where: { status: { in: OPEN_STATUSES }, resolveDeadline: { lt: now } } }),
    db.issue.count({ where: { status: "RESOLVED" } }),
    db.issue.count({ where: { status: { in: OPEN_STATUSES }, escalationLevel: { gt: 0 } } }),
    db.issue.count({ where: { status: "CLOSED", closedAt: { gte: since7 } } }),
    db.issue.count({ where: { status: { in: OPEN_STATUSES }, reopenCount: { gt: 0 } } }),
  ])

  // Resolution timing + SLA compliance over the last 30 days of closed issues.
  const closedRecent = await db.issue.findMany({
    where: { status: "CLOSED", closedAt: { gte: since30 } },
    select: { createdAt: true, resolvedAt: true, closedAt: true, resolveDeadline: true },
  })
  const resolveHrs: number[] = []
  const closeHrs: number[] = []
  let onTime = 0
  for (const i of closedRecent) {
    if (i.resolvedAt) resolveHrs.push(hoursBetween(i.createdAt, i.resolvedAt))
    if (i.closedAt) closeHrs.push(hoursBetween(i.createdAt, i.closedAt))
    if (i.resolveDeadline && i.resolvedAt && i.resolvedAt <= i.resolveDeadline) onTime++
  }

  // Open workload by severity, category, and owner.
  const [bySeverity, byCategory, byOwnerRaw] = await Promise.all([
    db.issue.groupBy({ by: ["severity"], where: { status: { in: OPEN_STATUSES } }, _count: true }),
    db.issue.groupBy({ by: ["category"], where: { status: { in: OPEN_STATUSES } }, _count: true }),
    db.issue.groupBy({ by: ["assignedToId"], where: { status: { in: OPEN_STATUSES }, assignedToId: { not: null } }, _count: true }),
  ])

  const ownerIds = byOwnerRaw.map((o) => o.assignedToId!).filter(Boolean)
  const owners = ownerIds.length
    ? await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : []
  const ownerName = new Map(owners.map((u) => [u.id, u.name]))
  const byOwner = byOwnerRaw
    .map((o) => ({ id: o.assignedToId!, name: ownerName.get(o.assignedToId!) ?? "—", count: o._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    tiles: { open, unassigned, overdue, awaitingVerification, escalated, closed7 },
    timing: {
      medianResolveHrs: median(resolveHrs),
      medianCloseHrs: median(closeHrs),
      slaCompliancePct: closedRecent.length ? Math.round((onTime / closedRecent.length) * 100) : null,
      closedCount: closedRecent.length,
      reopenedOpen,
    },
    bySeverity: bySeverity.map((s) => ({ key: s.severity as string, count: s._count })),
    byCategory: byCategory.map((c) => ({ key: c.category as string, count: c._count })),
    byOwner,
  }
}
