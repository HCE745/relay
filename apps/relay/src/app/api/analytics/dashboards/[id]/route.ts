import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { validateWidgetConfig } from "@/lib/analytics/metrics-engine"
import type { WidgetConfig } from "@/lib/analytics/metrics-engine"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { organizationId, userId, role } = session

  const layout = await prisma.dashboardLayout.findFirst({
    where: { id, organizationId },
  })
  if (!layout) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isOrgLevel = layout.layoutType === "ORG_SHARED" || layout.layoutType === "ORG_DEFAULT"
  if (isOrgLevel && role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can edit org-level dashboards" }, { status: 403 })
  }
  if (!isOrgLevel && layout.createdById !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json() as { name?: string; widgets?: unknown[] }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : layout.name

  const rawWidgets = Array.isArray(body.widgets) ? body.widgets : null
  let widgets = layout.widgets
  if (rawWidgets) {
    const validated: WidgetConfig[] = []
    for (const w of rawWidgets) {
      const result = validateWidgetConfig(w)
      if (!result.valid) return NextResponse.json({ error: `Widget validation: ${result.error}` }, { status: 400 })
      validated.push(result.config)
    }
    widgets = validated as unknown as typeof layout.widgets
  }

  const updated = await prisma.dashboardLayout.update({
    where: { id },
    data:  { name, widgets: widgets as object[] },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { organizationId, userId, role } = session

  const layout = await prisma.dashboardLayout.findFirst({
    where: { id, organizationId },
  })
  if (!layout) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isOrgLevel = layout.layoutType === "ORG_SHARED" || layout.layoutType === "ORG_DEFAULT"
  if (isOrgLevel && role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete org-level dashboards" }, { status: 403 })
  }
  if (!isOrgLevel && layout.createdById !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.dashboardLayout.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
