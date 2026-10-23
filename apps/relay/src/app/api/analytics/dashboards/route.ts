import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { validateWidgetConfig } from "@/lib/analytics/metrics-engine"
import type { WidgetConfig } from "@/lib/analytics/metrics-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { organizationId, userId, role } = session
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const layouts = await prisma.dashboardLayout.findMany({
    where: {
      organizationId,
      OR: [{ createdById: userId }, { layoutType: "SHARED" }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(layouts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { organizationId, userId, role } = session
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    id?: string
    name?: string
    widgets?: unknown[]
    isDefault?: boolean
    layoutType?: string
  }

  // Validate widgets
  const rawWidgets = Array.isArray(body.widgets) ? body.widgets : []
  const validatedWidgets: WidgetConfig[] = []
  for (const w of rawWidgets) {
    const result = validateWidgetConfig(w)
    if (!result.valid) return NextResponse.json({ error: `Widget validation: ${result.error}` }, { status: 400 })
    validatedWidgets.push(result.config)
  }

  const name       = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "My Dashboard"
  const layoutType = body.layoutType === "SHARED" ? "SHARED" : "PERSONAL"

  // Upsert: if id provided and owned by this user, update; else create
  if (body.id) {
    const existing = await prisma.dashboardLayout.findFirst({
      where: { id: body.id, organizationId, createdById: userId },
    })
    if (!existing) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })

    const updated = await prisma.dashboardLayout.update({
      where: { id: body.id },
      data:  { name, widgets: validatedWidgets as object[], layoutType, isDefault: body.isDefault ?? existing.isDefault },
    })
    return NextResponse.json(updated)
  }

  // If marking as default, clear existing defaults for this user
  if (body.isDefault) {
    await prisma.dashboardLayout.updateMany({
      where: { createdById: userId, isDefault: true },
      data:  { isDefault: false },
    })
  }

  const layout = await prisma.dashboardLayout.create({
    data: {
      organizationId,
      createdById: userId,
      name,
      widgets: validatedWidgets as object[],
      layoutType,
      isDefault: body.isDefault ?? false,
    },
  })

  return NextResponse.json(layout, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { organizationId, userId } = session
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const existing = await prisma.dashboardLayout.findFirst({
    where: { id, organizationId, createdById: userId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.dashboardLayout.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
