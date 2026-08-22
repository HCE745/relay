import { prisma } from "@/lib/prisma"
import type { ViewFilters } from "@/lib/custom-view-config"
import type { ChartDataPoint, ChartMetricKey, ChartPeriod } from "@/lib/widget-registry"

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

    // Industry-specific KPI metrics
    case "mfg_repeat_equipment_problems":
      return prisma.issue.groupBy({
        by: ["assetId"],
        where: { organizationId: orgId, category: "EQUIPMENT_BREAKDOWN", status: { notIn: ["RESOLVED", "CLOSED"] }, assetId: { not: null } },
        _count: { id: true },
      }).then(groups => groups.filter(g => g._count.id > 1).length)

    case "pm_tenant_requests_today": {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return prisma.issue.count({ where: { organizationId: orgId, category: "TENANT_REQUEST", createdAt: { gte: today } } })
    }

    case "pm_properties_with_issues":
      return prisma.issue.findMany({
        where: { organizationId: orgId, status: { notIn: ["RESOLVED", "CLOSED"] }, locationId: { not: null } },
        select: { locationId: true },
        distinct: ["locationId"],
      }).then(rows => rows.length)

    case "cw_customer_reports_today": {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return prisma.issue.count({ where: { organizationId: orgId, category: "CUSTOMER_REPORT", createdAt: { gte: today } } })
    }

    default:
      return 0
  }
}

// ── Chart data ────────────────────────────────────────────────────────────────

function buildDailyTrend(dates: Date[], since: Date, days: number): ChartDataPoint[] {
  const groups: Record<string, number> = {}
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10)
    groups[key] = (groups[key] ?? 0) + 1
  }
  const result: ChartDataPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    result.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: groups[key] ?? 0 })
  }
  return result
}

export async function fetchChartData(
  orgId: string,
  metric: ChartMetricKey,
  period?: ChartPeriod,
): Promise<ChartDataPoint[]> {
  const days   = period === "7d" ? 7 : period === "90d" ? 90 : 30
  const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  since.setHours(0, 0, 0, 0)
  const baseWhere = { organizationId: orgId }

  switch (metric) {
    case "issues_by_status": {
      const rows = await prisma.issue.groupBy({ by: ["status"], where: baseWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
      return rows.map(r => ({ label: r.status.replace(/_/g, " "), value: r._count.id }))
    }

    case "issues_by_priority": {
      const ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      const rows = await prisma.issue.groupBy({ by: ["priority"], where: baseWhere, _count: { id: true } })
      return rows
        .sort((a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9))
        .map(r => ({ label: r.priority, value: r._count.id }))
    }

    case "issues_by_category": {
      const rows = await prisma.issue.groupBy({ by: ["category"], where: baseWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
      return rows.map(r => ({
        label: r.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        value: r._count.id,
      }))
    }

    case "issues_by_location": {
      const groups = await prisma.issue.groupBy({
        by: ["locationId"],
        where: { ...baseWhere, locationId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      })
      const ids = groups.map(g => g.locationId!).filter(Boolean)
      const locs = await prisma.location.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      const nameMap = Object.fromEntries(locs.map(l => [l.id, l.name]))
      return groups.map(g => ({ label: nameMap[g.locationId!] ?? "Unknown", value: g._count.id }))
    }

    case "issues_over_time": {
      const issues = await prisma.issue.findMany({
        where: { ...baseWhere, createdAt: { gte: since } },
        select: { createdAt: true },
      })
      return buildDailyTrend(issues.map(i => i.createdAt), since, days)
    }

    case "equipment_status": {
      const rows = await prisma.asset.groupBy({ by: ["status"], where: baseWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
      const LABELS: Record<string, string> = { OPERATIONAL: "Operational", MAINTENANCE: "Maintenance", INACTIVE: "Inactive", OUT_OF_SERVICE: "Out of Service" }
      return rows.map(r => ({ label: LABELS[r.status] ?? r.status, value: r._count.id }))
    }

    case "resolution_trend": {
      const issues = await prisma.issue.findMany({
        where: { ...baseWhere, status: "RESOLVED", resolvedAt: { gte: since, not: null } },
        select: { resolvedAt: true },
      })
      return buildDailyTrend(issues.map(i => i.resolvedAt!), since, days)
    }

    default:
      return []
  }
}
