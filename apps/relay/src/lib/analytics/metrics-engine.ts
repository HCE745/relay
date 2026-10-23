import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { VisualType, MetricResult, WidgetConfig } from "./types"
import { METRICS_CATALOG } from "./types"

export type { VisualType, MetricResult, WidgetConfig }
export { METRICS_CATALOG, DASHBOARD_TEMPLATES } from "./types"

// ─── Server-only types ────────────────────────────────────────────────────────

export interface MetricParams {
  organizationId: string
  userId: string
  role: string
  dateRange: { start: Date; end: Date }
  scopeWhere: { locationId?: string; departmentId?: string }
  filters?: Record<string, string>
  visualType: VisualType
}

export interface MetricDefinition {
  key: string
  label: string
  allowedRoles: string[]
  supportedVisualTypes: VisualType[]
  calculate(params: MetricParams): Promise<MetricResult>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"]

function issueBaseWhere(
  organizationId: string,
  dateRange: { start: Date; end: Date },
  scopeWhere: { locationId?: string; departmentId?: string },
  extraFilters?: Record<string, string>,
): Prisma.IssueWhereInput {
  const w: Prisma.IssueWhereInput = {
    organizationId,
    createdAt: { gte: dateRange.start, lte: dateRange.end },
  }
  if (scopeWhere.locationId)   w.locationId   = scopeWhere.locationId
  if (scopeWhere.departmentId) w.departmentId = scopeWhere.departmentId
  if (extraFilters?.status)    w.status        = extraFilters.status
  if (extraFilters?.priority)  w.priority      = extraFilters.priority
  if (extraFilters?.category)  w.category      = extraFilters.category
  return w
}

function rawScopeFragments(scopeWhere: { locationId?: string; departmentId?: string }) {
  return {
    locFrag:  scopeWhere.locationId   ? Prisma.sql`AND "locationId"   = ${scopeWhere.locationId}`   : Prisma.empty,
    deptFrag: scopeWhere.departmentId ? Prisma.sql`AND "departmentId" = ${scopeWhere.departmentId}` : Prisma.empty,
  }
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

const issuesCount: MetricDefinition = {
  key: "issues.count",
  label: "Total Issues",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE", "DATA_TABLE"],
  async calculate(p) {
    const where = issueBaseWhere(p.organizationId, p.dateRange, p.scopeWhere, p.filters)

    if (p.visualType === "BAR_CHART") {
      const rows = await prisma.issue.groupBy({ by: ["status"], where, _count: true })
      return { type: "series", data: rows.map(r => ({ label: r.status, value: r._count })) }
    }

    if (p.visualType === "TREND_LINE") {
      const { locFrag, deptFrag } = rawScopeFragments(p.scopeWhere)
      type Row = { day: Date; count: bigint }
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
        FROM "Issue"
        WHERE "organizationId" = ${p.organizationId}
          AND "createdAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
          ${locFrag} ${deptFrag}
        GROUP BY day ORDER BY day ASC
      `
      return { type: "series", data: rows.map(r => ({ label: r.day.toISOString().slice(0, 10), value: Number(r.count) })) }
    }

    if (p.visualType === "DATA_TABLE") {
      const rows = await prisma.issue.groupBy({ by: ["category"], where, _count: true, orderBy: { _count: { category: "desc" } } })
      return {
        type: "table",
        columns: [{ key: "category", label: "Category" }, { key: "count", label: "Count" }],
        rows: rows.map(r => ({ category: r.category ?? "—", count: r._count })),
      }
    }

    const value = await prisma.issue.count({ where })
    return { type: "scalar", value }
  },
}

const issuesResolved: MetricDefinition = {
  key: "issues.resolved",
  label: "Resolved Issues",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"],
  async calculate(p) {
    const where = { ...issueBaseWhere(p.organizationId, p.dateRange, p.scopeWhere, p.filters), status: "RESOLVED" as const }

    if (p.visualType === "TREND_LINE") {
      const { locFrag, deptFrag } = rawScopeFragments(p.scopeWhere)
      type Row = { day: Date; count: bigint }
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT DATE_TRUNC('day', "resolvedAt") AS day, COUNT(*) AS count
        FROM "Issue"
        WHERE "organizationId" = ${p.organizationId}
          AND status = 'RESOLVED'
          AND "resolvedAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
          ${locFrag} ${deptFrag}
        GROUP BY day ORDER BY day ASC
      `
      return { type: "series", data: rows.map(r => ({ label: r.day.toISOString().slice(0, 10), value: Number(r.count) })) }
    }

    const value = await prisma.issue.count({ where })
    return { type: "scalar", value }
  },
}

const issuesOpen: MetricDefinition = {
  key: "issues.open",
  label: "Open Issues",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "BAR_CHART"],
  async calculate(p) {
    const where: Prisma.IssueWhereInput = {
      organizationId: p.organizationId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    }
    if (p.scopeWhere.locationId)   where.locationId   = p.scopeWhere.locationId
    if (p.scopeWhere.departmentId) where.departmentId = p.scopeWhere.departmentId

    if (p.visualType === "BAR_CHART") {
      const rows = await prisma.issue.groupBy({ by: ["priority"], where, _count: true })
      return { type: "series", data: rows.map(r => ({ label: r.priority ?? "NONE", value: r._count })) }
    }

    const value = await prisma.issue.count({ where })
    return { type: "scalar", value }
  },
}

const issuesOverdue: MetricDefinition = {
  key: "issues.overdue",
  label: "Overdue Issues",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "LEADERBOARD"],
  async calculate(p) {
    const now = new Date()
    const where: Prisma.IssueWhereInput = {
      organizationId: p.organizationId,
      status:  { notIn: ["RESOLVED", "CLOSED"] },
      dueDate: { lt: now, not: null },
    }
    if (p.scopeWhere.locationId)   where.locationId   = p.scopeWhere.locationId
    if (p.scopeWhere.departmentId) where.departmentId = p.scopeWhere.departmentId

    if (p.visualType === "LEADERBOARD") {
      const rows = await prisma.issue.groupBy({ by: ["category"], where, _count: true, orderBy: { _count: { category: "desc" } }, take: 10 })
      return {
        type: "ranked",
        items: rows.map((r, i) => ({ rank: i + 1, label: r.category ?? "—", value: r._count })),
      }
    }

    const value = await prisma.issue.count({ where })
    return { type: "scalar", value }
  },
}

const issuesResolutionRate: MetricDefinition = {
  key: "issues.resolution_rate",
  label: "Resolution Rate",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD"],
  async calculate(p) {
    const where = issueBaseWhere(p.organizationId, p.dateRange, p.scopeWhere, p.filters)
    const [total, resolved] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.count({ where: { ...where, status: "RESOLVED" } }),
    ])
    const value = total === 0 ? 0 : Math.round((resolved / total) * 100)
    return { type: "scalar", value, unit: "%" }
  },
}

const issuesAvgResolutionTime: MetricDefinition = {
  key: "issues.avg_resolution_time",
  label: "Avg Resolution Time",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD"],
  async calculate(p) {
    const { locFrag, deptFrag } = rawScopeFragments(p.scopeWhere)
    type Row = { avg_days: number | null }
    const [row] = await prisma.$queryRaw<Row[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400)::float AS avg_days
      FROM "Issue"
      WHERE "organizationId" = ${p.organizationId}
        AND status = 'RESOLVED'
        AND "resolvedAt" IS NOT NULL
        AND "createdAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
        ${locFrag} ${deptFrag}
    `
    const value = row?.avg_days != null ? Math.round(row.avg_days * 10) / 10 : 0
    return { type: "scalar", value, unit: "days" }
  },
}

const suggestionsCount: MetricDefinition = {
  key: "suggestions.count",
  label: "Suggestions",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE"],
  async calculate(p) {
    const where: Prisma.SuggestionWhereInput = {
      organizationId: p.organizationId,
      createdAt: { gte: p.dateRange.start, lte: p.dateRange.end },
    }
    if (p.filters?.status) where.status = p.filters.status

    if (p.visualType === "BAR_CHART") {
      const rows = await prisma.suggestion.groupBy({ by: ["status"], where, _count: true })
      return { type: "series", data: rows.map(r => ({ label: r.status, value: r._count })) }
    }

    if (p.visualType === "TREND_LINE") {
      type Row = { day: Date; count: bigint }
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
        FROM "Suggestion"
        WHERE "organizationId" = ${p.organizationId}
          AND "createdAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
        GROUP BY day ORDER BY day ASC
      `
      return { type: "series", data: rows.map(r => ({ label: r.day.toISOString().slice(0, 10), value: Number(r.count) })) }
    }

    const value = await prisma.suggestion.count({ where })
    return { type: "scalar", value }
  },
}

const suggestionsImplemented: MetricDefinition = {
  key: "suggestions.implemented",
  label: "Implemented Suggestions",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD"],
  async calculate(p) {
    const value = await prisma.suggestion.count({
      where: {
        organizationId: p.organizationId,
        status: "IMPLEMENTED",
        createdAt: { gte: p.dateRange.start, lte: p.dateRange.end },
      },
    })
    return { type: "scalar", value }
  },
}

const assignmentsCompleted: MetricDefinition = {
  key: "assignments.completed",
  label: "Completed Assignments",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"],
  async calculate(p) {
    const where: Prisma.AssignmentWhereInput = {
      orgId: p.organizationId,
      completedAt: { gte: p.dateRange.start, lte: p.dateRange.end },
    }
    if (p.scopeWhere.departmentId) {
      where.assignee = { departmentId: p.scopeWhere.departmentId }
    }

    if (p.visualType === "TREND_LINE") {
      type Row = { day: Date; count: bigint }
      const deptFrag = p.scopeWhere.departmentId
        ? Prisma.sql`AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."assigneeId" AND u."departmentId" = ${p.scopeWhere.departmentId})`
        : Prisma.empty
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT DATE_TRUNC('day', a."completedAt") AS day, COUNT(*) AS count
        FROM "Assignment" a
        WHERE a."orgId" = ${p.organizationId}
          AND a."completedAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
          ${deptFrag}
        GROUP BY day ORDER BY day ASC
      `
      return { type: "series", data: rows.map(r => ({ label: r.day.toISOString().slice(0, 10), value: Number(r.count) })) }
    }

    const value = await prisma.assignment.count({ where })
    return { type: "scalar", value }
  },
}

const assignmentsOverdue: MetricDefinition = {
  key: "assignments.overdue",
  label: "Overdue Assignments",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD"],
  async calculate(p) {
    const now = new Date()
    const where: Prisma.AssignmentWhereInput = {
      orgId: p.organizationId,
      completedAt: null,
      dueDate: { lt: now, not: null },
    }
    if (p.scopeWhere.departmentId) {
      where.assignee = { departmentId: p.scopeWhere.departmentId }
    }
    const value = await prisma.assignment.count({ where })
    return { type: "scalar", value }
  },
}

const qrSubmissions: MetricDefinition = {
  key: "qr.submissions",
  label: "QR Submissions",
  allowedRoles: ALLOWED_ROLES,
  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"],
  async calculate(p) {
    const where: Prisma.QrCodeSubmissionWhereInput = {
      organizationId: p.organizationId,
      createdAt: { gte: p.dateRange.start, lte: p.dateRange.end },
    }

    if (p.visualType === "TREND_LINE") {
      type Row = { day: Date; count: bigint }
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
        FROM "QrCodeSubmission"
        WHERE "organizationId" = ${p.organizationId}
          AND "createdAt" BETWEEN ${p.dateRange.start} AND ${p.dateRange.end}
        GROUP BY day ORDER BY day ASC
      `
      return { type: "series", data: rows.map(r => ({ label: r.day.toISOString().slice(0, 10), value: Number(r.count) })) }
    }

    const value = await prisma.qrCodeSubmission.count({ where })
    return { type: "scalar", value }
  },
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const ALL_METRICS: MetricDefinition[] = [
  issuesCount,
  issuesResolved,
  issuesOpen,
  issuesOverdue,
  issuesResolutionRate,
  issuesAvgResolutionTime,
  suggestionsCount,
  suggestionsImplemented,
  assignmentsCompleted,
  assignmentsOverdue,
  qrSubmissions,
]

export const MetricsRegistry = new Map<string, MetricDefinition>(
  ALL_METRICS.map(m => [m.key, m]),
)

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateWidgetConfig(config: unknown): { valid: true; config: WidgetConfig } | { valid: false; error: string } {
  if (!config || typeof config !== "object") return { valid: false, error: "Config must be an object" }
  const c = config as Record<string, unknown>

  if (typeof c.id !== "string" || !c.id)           return { valid: false, error: "id is required" }
  if (typeof c.metricKey !== "string" || !c.metricKey) return { valid: false, error: "metricKey is required" }
  if (typeof c.visualType !== "string" || !c.visualType) return { valid: false, error: "visualType is required" }

  const metric = MetricsRegistry.get(c.metricKey)
  if (!metric) return { valid: false, error: `Unknown metricKey: ${c.metricKey}` }

  const visualType = c.visualType as VisualType
  if (!metric.supportedVisualTypes.includes(visualType)) {
    return { valid: false, error: `${c.metricKey} does not support visualType ${visualType}` }
  }

  return {
    valid: true,
    config: {
      id:         c.id,
      metricKey:  c.metricKey,
      visualType,
      title:      typeof c.title === "string" ? c.title : undefined,
      filters:    c.filters && typeof c.filters === "object" ? c.filters as Record<string, string> : undefined,
      width:      (c.width === 1 || c.width === 2 || c.width === 3) ? c.width : 1,
      position:   typeof c.position === "number" ? c.position : 0,
    },
  }
}
