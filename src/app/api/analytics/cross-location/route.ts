import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type CompareMode = "location" | "region" | "department"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { cross_location_analytics_enabled: true },
  })
  if (!org?.cross_location_analytics_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as { mode: CompareMode; ids: string[] }
  const { mode, ids } = body

  if (!ids || ids.length < 2 || ids.length > 6) {
    return NextResponse.json({ error: "Select 2–6 items" }, { status: 400 })
  }

  const orgId = session.organizationId

  async function metricsForLocation(locationId: string, name: string) {
    const [total, resolved, escalated, injuryCount, resolvedIssues, groupedTitles] = await Promise.all([
      prisma.issue.count({ where: { organizationId: orgId, locationId } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId, status: "RESOLVED" } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId, isEscalated: true } }),
      prisma.injuryReport.count({ where: { organizationId: orgId, locationId } }),
      prisma.issue.findMany({
        where: { organizationId: orgId, locationId, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
      }),
      prisma.issue.groupBy({
        by: ["title"],
        where: { organizationId: orgId, locationId },
        having: { title: { _count: { gt: 1 } } },
        _count: { id: true },
      }),
    ])

    const avgResolutionDays = resolvedIssues.length > 0
      ? resolvedIssues.reduce((sum, i) => {
          const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
          return sum + ms / 86400000
        }, 0) / resolvedIssues.length
      : null

    return {
      id: locationId,
      name,
      issueVolume: total,
      avgResolutionDays,
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      repeatIssueCount: groupedTitles.length,
      injuryReportCount: injuryCount,
    }
  }

  async function metricsForDepartment(deptId: string, name: string) {
    const [total, resolved, escalated, resolvedIssues, groupedTitles] = await Promise.all([
      prisma.issue.count({ where: { organizationId: orgId, departmentId: deptId } }),
      prisma.issue.count({ where: { organizationId: orgId, departmentId: deptId, status: "RESOLVED" } }),
      prisma.issue.count({ where: { organizationId: orgId, departmentId: deptId, isEscalated: true } }),
      prisma.issue.findMany({
        where: { organizationId: orgId, departmentId: deptId, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
      }),
      prisma.issue.groupBy({
        by: ["title"],
        where: { organizationId: orgId, departmentId: deptId },
        having: { title: { _count: { gt: 1 } } },
        _count: { id: true },
      }),
    ])

    const avgResolutionDays = resolvedIssues.length > 0
      ? resolvedIssues.reduce((sum, i) => {
          const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
          return sum + ms / 86400000
        }, 0) / resolvedIssues.length
      : null

    return {
      id: deptId,
      name,
      issueVolume: total,
      avgResolutionDays,
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      repeatIssueCount: groupedTitles.length,
      injuryReportCount: 0,
    }
  }

  async function metricsForRegion(regionId: string, name: string) {
    const locationIds = await prisma.location.findMany({
      where: { regionId, organizationId: orgId },
      select: { id: true },
    }).then(ls => ls.map(l => l.id))

    if (locationIds.length === 0) {
      return { id: regionId, name, issueVolume: 0, avgResolutionDays: null, escalationRate: 0, repeatIssueCount: 0, injuryReportCount: 0 }
    }

    const [total, escalated, injuryCount, resolvedIssues, groupedTitles] = await Promise.all([
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds } } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds }, isEscalated: true } }),
      prisma.injuryReport.count({ where: { organizationId: orgId, locationId: { in: locationIds } } }),
      prisma.issue.findMany({
        where: { organizationId: orgId, locationId: { in: locationIds }, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 200,
      }),
      prisma.issue.groupBy({
        by: ["title"],
        where: { organizationId: orgId, locationId: { in: locationIds } },
        having: { title: { _count: { gt: 1 } } },
        _count: { id: true },
      }),
    ])

    const avgResolutionDays = resolvedIssues.length > 0
      ? resolvedIssues.reduce((sum, i) => {
          const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
          return sum + ms / 86400000
        }, 0) / resolvedIssues.length
      : null

    return {
      id: regionId,
      name,
      issueVolume: total,
      avgResolutionDays,
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      repeatIssueCount: groupedTitles.length,
      injuryReportCount: injuryCount,
    }
  }

  let metrics
  if (mode === "location") {
    const locs = await prisma.location.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(locs.map(l => [l.id, l.name]))
    metrics = await Promise.all(ids.map(id => metricsForLocation(id, nameMap[id] ?? id)))
  } else if (mode === "department") {
    const depts = await prisma.department.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(depts.map(d => [d.id, d.name]))
    metrics = await Promise.all(ids.map(id => metricsForDepartment(id, nameMap[id] ?? id)))
  } else {
    const regs = await prisma.region.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(regs.map(r => [r.id, r.name]))
    metrics = await Promise.all(ids.map(id => metricsForRegion(id, nameMap[id] ?? id)))
  }

  return NextResponse.json({ metrics })
}
