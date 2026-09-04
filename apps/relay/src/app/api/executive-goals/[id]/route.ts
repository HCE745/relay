import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const goal = await prisma.executiveGoal.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

  const body = await request.json()
  const { title, description, metricType, targetValue, unit, targetDate, scope, scopeId, status } = body

  const updated = await prisma.executiveGoal.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(metricType !== undefined ? { metricType } : {}),
      ...(targetValue !== undefined ? { targetValue: parseFloat(targetValue) } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(targetDate !== undefined ? { targetDate: new Date(targetDate) } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(scopeId !== undefined ? { scopeId } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: { progress: { orderBy: { calculatedAt: "desc" }, take: 10 } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const { id } = await params

  const goal = await prisma.executiveGoal.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

  await prisma.executiveGoal.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
