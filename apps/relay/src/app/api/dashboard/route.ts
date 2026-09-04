import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = session.organizationId

  const [
    totalIssues,
    openIssues,
    escalatedIssues,
    resolvedIssues,
    criticalIssues,
    totalAssets,
    recentIssues,
    issuesByCategory,
    issuesByPriority,
  ] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "OPEN" } }),
    prisma.issue.count({ where: { organizationId: orgId, isEscalated: true } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "RESOLVED" } }),
    prisma.issue.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.asset.count({ where: { organizationId: orgId } }),
    prisma.issue.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        reportedBy: { select: { name: true } },
        location: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.issue.groupBy({
      by: ["category"],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
    prisma.issue.groupBy({
      by: ["priority"],
      where: { organizationId: orgId, status: { not: "RESOLVED" } },
      _count: { id: true },
    }),
  ])

  return NextResponse.json({
    stats: { totalIssues, openIssues, escalatedIssues, resolvedIssues, criticalIssues, totalAssets },
    recentIssues,
    issuesByCategory,
    issuesByPriority,
  })
}
