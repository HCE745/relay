import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    include: {
      location: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { nextDueAt: "asc" },
  })
  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    title: string
    description?: string
    recurrence?: string
    nextDueAt: string
    locationId?: string
    assignedToId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })
  if (!body.nextDueAt) return NextResponse.json({ error: "nextDueAt required" }, { status: 400 })

  const schedule = await prisma.maintenanceSchedule.create({
    data: {
      organizationId: session.organizationId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      recurrence: body.recurrence ?? "once",
      nextDueAt: new Date(body.nextDueAt),
      locationId: body.locationId || null,
      assignedToId: body.assignedToId || null,
    },
    include: {
      location: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(schedule, { status: 201 })
}
