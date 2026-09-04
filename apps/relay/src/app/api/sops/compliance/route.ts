import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// GET /api/sops/compliance — SOPs with issue citation counts for compliance analysis
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER", "SUPERVISOR", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sops = await prisma.sOP.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    include: {
      _count: { select: { issues: true } },
      department: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const totalViolations = await prisma.issue.count({
    where: { organizationId: session.organizationId, sopViolation: true },
  })

  const recentViolations = await prisma.issue.count({
    where: {
      organizationId: session.organizationId,
      sopViolation: true,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  })

  return NextResponse.json({
    sops: sops.map(s => ({
      id:         s.id,
      title:      s.title,
      category:   s.category,
      department: s.department?.name ?? null,
      citedCount: s._count.issues,
    })),
    totalViolations,
    recentViolations,
  })
}
