import { prisma } from "@/lib/prisma"
import type { ViewFilters } from "@/lib/custom-view-config"

type SortPair = [string, "asc" | "desc"]

export function resolveSortPairs(field: string | null | undefined, dir: string | null | undefined): SortPair[] {
  if (field === "createdAt" && dir === "asc")  return [["createdAt", "asc"]]
  if (field === "createdAt" && dir === "desc") return [["createdAt", "desc"]]
  if (field === "updatedAt" && dir === "desc") return [["updatedAt", "desc"]]
  return [["priority", "desc"], ["createdAt", "desc"]]
}

export async function fetchIssues(
  orgId: string,
  filters: ViewFilters,
  sortField?: string | null,
  sortDir?: string | null,
  limit?: number,
) {
  const where: Record<string, unknown> = { organizationId: orgId }
  if (filters.status)     where.status     = filters.status
  if (filters.priority)   where.priority   = filters.priority
  if (filters.category)   where.category   = filters.category
  if (filters.search)     where.title      = { contains: filters.search, mode: "insensitive" }
  if (filters.locationId) where.locationId = filters.locationId
  if (filters.isEscalated === true || (filters.isEscalated as unknown) === "true") where.isEscalated = true

  const orderBy = resolveSortPairs(sortField, sortDir).map(([f, d]) => ({ [f]: d }))

  return prisma.issue.findMany({
    where,
    orderBy,
    ...(limit ? { take: limit } : {}),
    include: {
      reportedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      location:   { select: { name: true, id: true } },
      asset:      { select: { name: true } },
      _count:     { select: { comments: true } },
    },
  })
}

export async function fetchKpiCount(orgId: string, metric: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (metric) {
    case "open_issues":
      return prisma.issue.count({ where: { organizationId: orgId, status: "OPEN" } })
    case "escalated_issues":
      return prisma.issue.count({ where: { organizationId: orgId, isEscalated: true } })
    case "critical_issues":
      return prisma.issue.count({
        where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: ["CLOSED", "RESOLVED"] } },
      })
    case "unassigned_issues":
      return prisma.issue.count({ where: { organizationId: orgId, assignedToId: null, status: "OPEN" } })
    case "resolved_today":
      return prisma.issue.count({ where: { organizationId: orgId, resolvedAt: { gte: today } } })
    case "new_today":
      return prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: today } } })
    case "total_assets":
      return prisma.asset.count({ where: { organizationId: orgId } })
    case "open_equipment_issues":
      return prisma.issue.count({ where: { organizationId: orgId, category: "EQUIPMENT_BREAKDOWN", status: "OPEN" } })
    case "open_maintenance_issues":
      return prisma.issue.count({ where: { organizationId: orgId, category: "MAINTENANCE", status: "OPEN" } })
    case "open_safety_issues":
      return prisma.issue.count({ where: { organizationId: orgId, category: "SAFETY", status: "OPEN" } })
    default:
      return 0
  }
}
