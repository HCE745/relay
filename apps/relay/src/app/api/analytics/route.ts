import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

// Returns analytics data scoped to the requesting user's role.
// Query params:
//   period: "7d" | "30d" | "90d" | "1y" (default "30d")
//   scope:  "org" | "loc:{id}" | "dept:{id}" (default based on role)
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role, organizationId, userId } = session
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const requestedScope = searchParams.get("scope") ?? "org"

  // Resolve date range
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Build Prisma where clause based on scope + role restrictions
  const baseWhere: Prisma.IssueWhereInput = { organizationId }

  if (role === "SUPERVISOR") {
    // Supervisor only sees their own department
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } })
    if (user?.departmentId) baseWhere.departmentId = user.departmentId
  } else if (role === "MANAGER") {
    // Manager can see org, or specific loc/dept if scoped
    if (requestedScope.startsWith("loc:")) {
      const locId = requestedScope.slice(4)
      baseWhere.locationId = locId
    } else if (requestedScope.startsWith("dept:")) {
      const deptId = requestedScope.slice(5)
      baseWhere.departmentId = deptId
    }
    // else: full org scope for manager
  } else {
    // ADMIN — respect requested scope
    if (requestedScope.startsWith("loc:")) {
      baseWhere.locationId = requestedScope.slice(4)
    } else if (requestedScope.startsWith("dept:")) {
      baseWhere.departmentId = requestedScope.slice(5)
    }
  }

  const scopedWhere = { ...baseWhere, createdAt: { gte: since } }

  // ── Core counts ────────────────────────────────────────────────────────────
  const [total, byStatus, byCategory, byPriority] = await Promise.all([
    prisma.issue.count({ where: scopedWhere }),
    prisma.issue.groupBy({ by: ["status"], where: scopedWhere, _count: true }),
    prisma.issue.groupBy({ by: ["category"], where: scopedWhere, _count: true }),
    prisma.issue.groupBy({ by: ["priority"], where: scopedWhere, _count: true }),
  ])

  // ── Resolution time ────────────────────────────────────────────────────────
  const resolvedIssues = await prisma.issue.findMany({
    where: { ...scopedWhere, status: "RESOLVED", resolvedAt: { not: null } },
    select: { createdAt: true, resolvedAt: true },
  })
  const avgResolutionDays =
    resolvedIssues.length > 0
      ? resolvedIssues.reduce((sum, i) => {
          const ms = i.resolvedAt!.getTime() - i.createdAt.getTime()
          return sum + ms / (1000 * 60 * 60 * 24)
        }, 0) / resolvedIssues.length
      : null

  // ── Monthly trend (raw SQL for efficiency) ────────────────────────────────
  type TrendRow = { month: Date; total: bigint; resolved: bigint }
  const trendRows = await prisma.$queryRaw<TrendRow[]>`
    SELECT
      DATE_TRUNC('month', "createdAt") AS month,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved
    FROM "Issue"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" >= ${since}
      ${baseWhere.locationId ? Prisma.sql`AND "locationId" = ${baseWhere.locationId}` : Prisma.empty}
      ${baseWhere.departmentId ? Prisma.sql`AND "departmentId" = ${baseWhere.departmentId}` : Prisma.empty}
    GROUP BY month
    ORDER BY month ASC
  `
  const trend = trendRows.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    total: Number(r.total),
    resolved: Number(r.resolved),
  }))

  // ── Bottleneck: unassigned issues waiting ─────────────────────────────────
  type BottleneckRow = { category: string; avg_days: number }
  const bottleneckRows = await prisma.$queryRaw<BottleneckRow[]>`
    SELECT
      category,
      AVG(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400)::float AS avg_days
    FROM "Issue"
    WHERE "organizationId" = ${organizationId}
      AND "assignedToId" IS NULL
      AND status NOT IN ('RESOLVED', 'CLOSED')
      AND "createdAt" >= ${since}
      ${baseWhere.locationId ? Prisma.sql`AND "locationId" = ${baseWhere.locationId}` : Prisma.empty}
      ${baseWhere.departmentId ? Prisma.sql`AND "departmentId" = ${baseWhere.departmentId}` : Prisma.empty}
    GROUP BY category
    ORDER BY avg_days DESC
    LIMIT 5
  `

  // ── Repeat issues (same title appears multiple times) ─────────────────────
  type RepeatRow = { title: string; count: bigint }
  const repeatRows = await prisma.$queryRaw<RepeatRow[]>`
    SELECT title, COUNT(*) AS count
    FROM "Issue"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" >= ${since}
      ${baseWhere.locationId ? Prisma.sql`AND "locationId" = ${baseWhere.locationId}` : Prisma.empty}
      ${baseWhere.departmentId ? Prisma.sql`AND "departmentId" = ${baseWhere.departmentId}` : Prisma.empty}
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `

  // ── Location performance (admin/manager org scope only) ───────────────────
  let locationPerformance: Array<{ id: string; name: string; total: number; avgResolutionDays: number | null }> = []
  if (role === "ADMIN" && requestedScope === "org") {
    type LocPerfRow = { id: string; name: string; total: bigint; avg_resolution_days: number | null }
    const locRows = await prisma.$queryRaw<LocPerfRow[]>`
      SELECT
        l.id,
        l.name,
        COUNT(i.id) AS total,
        AVG(
          CASE WHEN i.status = 'RESOLVED' AND i."resolvedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt")) / 86400
          END
        )::float AS avg_resolution_days
      FROM "Location" l
      LEFT JOIN "Issue" i ON i."locationId" = l.id
        AND i."organizationId" = ${organizationId}
        AND i."createdAt" >= ${since}
      WHERE l."organizationId" = ${organizationId}
      GROUP BY l.id, l.name
      ORDER BY total DESC
      LIMIT 10
    `
    locationPerformance = locRows.map((r) => ({
      id: r.id,
      name: r.name,
      total: Number(r.total),
      avgResolutionDays: r.avg_resolution_days ?? null,
    }))
  }

  // ── Category trend (prior period vs current for % change) ─────────────────
  const halfMs = (days / 2) * 24 * 60 * 60 * 1000
  const midpoint = new Date(Date.now() - halfMs)
  const [prevCounts, currCounts] = await Promise.all([
    prisma.issue.groupBy({
      by: ["category"],
      where: { ...baseWhere, createdAt: { gte: since, lt: midpoint } },
      _count: true,
    }),
    prisma.issue.groupBy({
      by: ["category"],
      where: { ...baseWhere, createdAt: { gte: midpoint } },
      _count: true,
    }),
  ])
  const prevMap = Object.fromEntries(prevCounts.map((r) => [r.category, r._count]))
  const trending = currCounts.map((r) => {
    const prev = prevMap[r.category] ?? 0
    const curr = r._count
    const pct = prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)
    return { category: r.category, current: curr, previous: prev, changePercent: pct }
  })

  // ── Resolution intelligence (categories with resolvedMethod data) ──────────
  type ResIntelRow = { category: string; count: bigint; avg_cost: number | null; avg_days: number | null; top_method: string | null }
  const resIntelRows = await prisma.$queryRaw<ResIntelRow[]>`
    SELECT
      category,
      COUNT(*) AS count,
      AVG("resolutionCost")::float AS avg_cost,
      AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400)::float AS avg_days,
      (
        SELECT "resolvedMethod"
        FROM "Issue" sub
        WHERE sub.category = i.category
          AND sub."organizationId" = ${organizationId}
          AND sub."resolvedMethod" IS NOT NULL
        GROUP BY "resolvedMethod"
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS top_method
    FROM "Issue" i
    WHERE "organizationId" = ${organizationId}
      AND status = 'RESOLVED'
      AND "resolvedMethod" IS NOT NULL
      ${baseWhere.locationId ? Prisma.sql`AND "locationId" = ${baseWhere.locationId}` : Prisma.empty}
      ${baseWhere.departmentId ? Prisma.sql`AND "departmentId" = ${baseWhere.departmentId}` : Prisma.empty}
    GROUP BY category
    ORDER BY count DESC
    LIMIT 8
  `

  return NextResponse.json({
    period,
    scope: requestedScope,
    total,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
    byCategory: byCategory.map((r) => ({ category: r.category, count: r._count })),
    byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count })),
    avgResolutionDays,
    trend,
    trending,
    bottlenecks: bottleneckRows.map((r) => ({ category: r.category, avgDaysUnassigned: r.avg_days })),
    repeatIssues: repeatRows.map((r) => ({ title: r.title, count: Number(r.count) })),
    locationPerformance,
    resolutionIntelligence: resIntelRows.map((r) => ({
      category: r.category,
      resolvedCount: Number(r.count),
      avgCost: r.avg_cost,
      avgDays: r.avg_days,
      topMethod: r.top_method,
    })),
  })
}
