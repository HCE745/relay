import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Returns internal (cross-department/location) and industry benchmarks.
// Query params:
//   period: "30d" | "90d" | "1y" (default "30d")
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role, organizationId } = session
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const days = period === "90d" ? 90 : period === "1y" ? 365 : 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // ── Org info for industry bucket matching ──────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { industry: true },
  })

  const industryBucket = normalizeIndustry(org?.industry)

  // ── Internal benchmark: avg resolution days per department ────────────────
  type DeptRow = { dept_id: string; dept_name: string; avg_days: number | null; total: bigint }
  const deptRows = await prisma.$queryRaw<DeptRow[]>`
    SELECT
      d.id AS dept_id,
      d.name AS dept_name,
      AVG(
        CASE WHEN i.status = 'RESOLVED' AND i."resolvedAt" IS NOT NULL
        THEN EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt")) / 86400
        END
      )::float AS avg_days,
      COUNT(i.id) AS total
    FROM "Department" d
    LEFT JOIN "Issue" i ON i."departmentId" = d.id
      AND i."organizationId" = ${organizationId}
      AND i."createdAt" >= ${since}
    WHERE d."organizationId" = ${organizationId}
    GROUP BY d.id, d.name
    ORDER BY avg_days ASC NULLS LAST
  `

  // ── Internal benchmark: avg resolution days per location ──────────────────
  type LocRow = { loc_id: string; loc_name: string; avg_days: number | null; total: bigint }
  const locRows = await prisma.$queryRaw<LocRow[]>`
    SELECT
      l.id AS loc_id,
      l.name AS loc_name,
      AVG(
        CASE WHEN i.status = 'RESOLVED' AND i."resolvedAt" IS NOT NULL
        THEN EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt")) / 86400
        END
      )::float AS avg_days,
      COUNT(i.id) AS total
    FROM "Location" l
    LEFT JOIN "Issue" i ON i."locationId" = l.id
      AND i."organizationId" = ${organizationId}
      AND i."createdAt" >= ${since}
    WHERE l."organizationId" = ${organizationId}
    GROUP BY l.id, l.name
    ORDER BY avg_days ASC NULLS LAST
  `

  // ── Industry benchmark from IssuePattern data ─────────────────────────────
  const industryPatterns = industryBucket
    ? await prisma.issuePattern.groupBy({
        by: ["category"],
        where: { industryBucket, resolvedAt: { not: null } },
        _avg: { resolvedInDays: true },
        _count: true,
      })
    : []

  // ── This org's resolution times by category for comparison ────────────────
  type OrgCatRow = { category: string; avg_days: number | null; count: bigint }
  const orgCatRows = await prisma.$queryRaw<OrgCatRow[]>`
    SELECT
      category,
      AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400)::float AS avg_days,
      COUNT(*) AS count
    FROM "Issue"
    WHERE "organizationId" = ${organizationId}
      AND status = 'RESOLVED'
      AND "resolvedAt" IS NOT NULL
      AND "createdAt" >= ${since}
    GROUP BY category
  `
  const orgCatMap = Object.fromEntries(
    orgCatRows.map((r) => [r.category, { avgDays: r.avg_days, count: Number(r.count) }])
  )

  const industryComparison = industryPatterns.map((p) => {
    const industryAvg = p._avg.resolvedInDays
    const orgData = orgCatMap[p.category]
    const orgAvg = orgData?.avgDays ?? null
    let vsIndustryPct: number | null = null
    if (industryAvg && orgAvg) {
      vsIndustryPct = Math.round(((orgAvg - industryAvg) / industryAvg) * 100)
    }
    return {
      category: p.category,
      industryAvgDays: industryAvg,
      industryCount: p._count,
      orgAvgDays: orgAvg,
      orgCount: orgData?.count ?? 0,
      vsIndustryPct,
    }
  })

  return NextResponse.json({
    period,
    industryBucket,
    deptBenchmarks: deptRows.map((r) => ({
      id: r.dept_id,
      name: r.dept_name,
      avgResolutionDays: r.avg_days,
      total: Number(r.total),
    })),
    locationBenchmarks: locRows.map((r) => ({
      id: r.loc_id,
      name: r.loc_name,
      avgResolutionDays: r.avg_days,
      total: Number(r.total),
    })),
    industryComparison,
  })
}

function normalizeIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null
  const lower = industry.toLowerCase()
  if (lower.includes("manufactur")) return "manufacturing"
  if (lower.includes("health") || lower.includes("medical") || lower.includes("hospital")) return "healthcare"
  if (lower.includes("retail") || lower.includes("store")) return "retail"
  if (lower.includes("logistics") || lower.includes("transport") || lower.includes("warehouse")) return "logistics"
  if (lower.includes("construction") || lower.includes("building")) return "construction"
  if (lower.includes("food") || lower.includes("beverage") || lower.includes("restaurant")) return "food_beverage"
  if (lower.includes("tech") || lower.includes("software") || lower.includes("it")) return "technology"
  if (lower.includes("education") || lower.includes("school") || lower.includes("university")) return "education"
  return null
}
