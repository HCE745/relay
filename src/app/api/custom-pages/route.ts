import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { Prisma } from "@/generated/prisma/client"
import type { InputJsonValue } from "@prisma/client/runtime/client"
import { CUSTOM_VIEW_ICON_NAMES } from "@/lib/custom-view-config"
import { parseWidgets, isMetricAllowedForIndustry, type CustomViewRefConfig, type KpiCountConfig } from "@/lib/widget-registry"

const toInput = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

async function parsePageBody(body: Record<string, unknown>, orgId: string) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : null
  if (!name) return { error: "Name is required" }

  const icon = typeof body.icon === "string" && CUSTOM_VIEW_ICON_NAMES.includes(body.icon)
    ? body.icon : null

  const description = typeof body.description === "string"
    ? body.description.trim().slice(0, 300) : null

  const showInSidebar = body.showInSidebar === true
  const sidebarOrder  = typeof body.sidebarOrder === "number"
    ? Math.max(0, Math.round(body.sidebarOrder)) : 0

  const rawWidgets = Array.isArray(body.widgets) ? body.widgets : []
  const widgetsResult = parseWidgets(rawWidgets)
  if ("error" in widgetsResult) return { error: widgetsResult.error }
  const widgets = widgetsResult

  // Validate industry-gated KPI metrics
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } })
  const orgIndustry = org?.industry ?? null
  for (const w of widgets) {
    if (w.type === "kpi-count") {
      const metric = (w.config as KpiCountConfig).metric
      if (!isMetricAllowedForIndustry(metric, orgIndustry)) {
        return { error: `Metric "${metric}" is not available for this organization` }
      }
    }
  }

  // Validate custom-view references belong to this org
  const viewRefIds = widgets
    .filter(w => w.type === "custom-view")
    .map(w => (w.config as CustomViewRefConfig).viewId)
  if (viewRefIds.length > 0) {
    const count = await prisma.customView.count({
      where: { id: { in: viewRefIds }, organizationId: orgId },
    })
    if (count !== viewRefIds.length) {
      return { error: "One or more referenced custom views do not exist" }
    }
  }

  return { name, icon, description, showInSidebar, sidebarOrder, widgets }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const pages = await prisma.customPage.findMany({
    where:   { organizationId: session.organizationId },
    orderBy: [{ sidebarOrder: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json(pages)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Custom pages are not available on Wash Essentials" }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const parsed = await parsePageBody(body, session.organizationId)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { name, icon, description, showInSidebar, sidebarOrder, widgets } = parsed

  const page = await prisma.customPage.create({
    data: {
      organizationId: session.organizationId,
      name,
      icon,
      description,
      widgets:        toInput(widgets),
      showInSidebar,
      sidebarOrder,
      createdBy:      session.userId,
    },
  })

  await prisma.workspaceChangeLog.create({
    data: {
      organizationId: session.organizationId,
      changedBy:      session.userId,
      changeType:     "customPage.create",
      before:         Prisma.DbNull,
      after:          toInput({ id: page.id, name: page.name }),
    },
  })

  return NextResponse.json(page)
}
