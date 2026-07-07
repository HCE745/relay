import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const goals = await prisma.executiveGoal.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { targetDate: "asc" },
    include: {
      progress: {
        orderBy: { calculatedAt: "desc" },
        take: 10,
      },
    },
  })

  return NextResponse.json(goals)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { executive_goals_enabled: true },
  })
  if (!org?.executive_goals_enabled) {
    return NextResponse.json({ error: "Executive goals not enabled" }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, metricType, targetValue, unit, targetDate, scope, scopeId } = body

  if (!title || !metricType || targetValue == null || !targetDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const goal = await prisma.executiveGoal.create({
    data: {
      organizationId: session.organizationId,
      title,
      description: description ?? undefined,
      metricType,
      targetValue: parseFloat(targetValue),
      currentValue: 0,
      unit: unit ?? "%",
      targetDate: new Date(targetDate),
      scope: scope ?? "org",
      scopeId: scopeId ?? undefined,
      status: "ACTIVE",
      isAtRisk: false,
      createdById: session.userId,
    },
    include: {
      progress: true,
    },
  })

  return NextResponse.json(goal, { status: 201 })
}
