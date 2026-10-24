import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { MetricsRegistry } from "@/lib/analytics/metrics-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const alerts = await prisma.dashboardAlert.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(alerts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const body = await req.json() as {
    name?: string
    metricKey?: string
    condition?: string
    threshold?: number
    dateRange?: string
    locationId?: string
    notifyUserIds?: string[]
  }

  if (!body.name || !body.metricKey || !body.condition || body.threshold == null) {
    return NextResponse.json({ error: "name, metricKey, condition, threshold are required" }, { status: 400 })
  }

  const VALID_CONDITIONS = ["GREATER_THAN", "LESS_THAN", "EQUALS"]
  if (!VALID_CONDITIONS.includes(body.condition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 })
  }

  if (!MetricsRegistry.has(body.metricKey)) {
    return NextResponse.json({ error: `Unknown metricKey: ${body.metricKey}` }, { status: 400 })
  }

  const alert = await prisma.dashboardAlert.create({
    data: {
      organizationId: session.organizationId,
      name:           body.name.trim(),
      metricKey:      body.metricKey,
      condition:      body.condition,
      threshold:      body.threshold,
      dateRange:      body.dateRange ?? "30d",
      locationId:     body.locationId ?? null,
      notifyUserIds:  body.notifyUserIds ?? [],
      createdById:    session.userId,
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
