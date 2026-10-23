import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { MetricsRegistry, validateWidgetConfig } from "@/lib/analytics/metrics-engine"
import type { MetricParams } from "@/lib/analytics/metrics-engine"
import { limiters, checkLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { organizationId, userId, role } = session
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Rate limit: 60/min per org
  const limited = await checkLimit(limiters.analyticsWidget, organizationId, "Too many widget requests")
  if (limited) return limited

  const sp = new URL(request.url).searchParams
  const metricKey  = sp.get("metricKey")
  const visualType = sp.get("visualType")
  const startStr   = sp.get("start")
  const endStr     = sp.get("end")

  if (!metricKey || !visualType) {
    return NextResponse.json({ error: "metricKey and visualType are required" }, { status: 400 })
  }

  const validation = validateWidgetConfig({ id: "req", metricKey, visualType, title: "" })
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

  const metric = MetricsRegistry.get(metricKey)!
  if (!metric.allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden for your role" }, { status: 403 })
  }

  // Parse date range
  const now   = new Date()
  const start = startStr ? new Date(startStr) : new Date(now.getTime() - 30 * 86400_000)
  const end   = endStr   ? new Date(endStr)   : now
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
  }

  // Parse optional filters
  let filters: Record<string, string> | undefined
  const filtersStr = sp.get("filters")
  if (filtersStr) {
    try { filters = JSON.parse(filtersStr) } catch { /* ignore */ }
  }

  // Resolve scope: SUPERVISOR → own department, ADMIN/MANAGER → full org (or per-widget filter)
  const scopeWhere: MetricParams["scopeWhere"] = {}
  if (role === "SUPERVISOR") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } })
    if (user?.departmentId) scopeWhere.departmentId = user.departmentId
  }

  const params: MetricParams = {
    organizationId,
    userId,
    role,
    dateRange: { start, end },
    scopeWhere,
    filters,
    visualType: validation.config.visualType,
  }

  try {
    const result = await metric.calculate(params)
    return NextResponse.json({ metricKey, visualType, result })
  } catch (err) {
    console.error("[analytics/widget] calculation error:", err)
    return NextResponse.json({ error: "Failed to compute metric" }, { status: 500 })
  }
}
