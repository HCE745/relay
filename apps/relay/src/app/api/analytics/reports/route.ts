import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const reports = await prisma.dashboardReport.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: { dashboardLayout: { select: { id: true, name: true } } },
  })

  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const body = await req.json() as {
    name?: string
    dashboardLayoutId?: string
    frequency?: string
    dayOfWeek?: number
    dayOfMonth?: number
    sendTime?: string
    recipients?: string[]
  }

  if (!body.name || !body.dashboardLayoutId || !body.frequency || !body.sendTime) {
    return NextResponse.json({ error: "name, dashboardLayoutId, frequency, sendTime are required" }, { status: 400 })
  }

  const VALID_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"]
  if (!VALID_FREQUENCIES.includes(body.frequency)) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 })
  }

  const layout = await prisma.dashboardLayout.findFirst({
    where: { id: body.dashboardLayoutId, organizationId: session.organizationId },
  })
  if (!layout) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })

  const report = await prisma.dashboardReport.create({
    data: {
      organizationId:    session.organizationId,
      dashboardLayoutId: body.dashboardLayoutId,
      name:              body.name.trim(),
      frequency:         body.frequency,
      dayOfWeek:         body.dayOfWeek ?? null,
      dayOfMonth:        body.dayOfMonth ?? null,
      sendTime:          body.sendTime,
      recipients:        body.recipients ?? [],
      createdById:       session.userId,
    },
  })

  return NextResponse.json(report, { status: 201 })
}
