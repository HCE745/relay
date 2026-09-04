import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { Prisma } from "@/generated/prisma/client"
import type { InputJsonValue } from "@prisma/client/runtime/client"
import type { ViewFilters, IssueColumnKey, ViewSortValue } from "@/lib/custom-view-config"
import { CUSTOM_VIEW_ICON_NAMES, ISSUE_COLUMN_KEYS, VIEW_SORT_OPTIONS } from "@/lib/custom-view-config"

const toInput = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

// Validate and sanitise incoming view body
function parseViewBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : null
  if (!name) return { error: "Name is required" }

  const icon = typeof body.icon === "string" && CUSTOM_VIEW_ICON_NAMES.includes(body.icon)
    ? body.icon : null

  const rawFilters = (body.filters ?? {}) as Partial<ViewFilters>
  const filters: ViewFilters = {}
  if (typeof rawFilters.status      === "string") filters.status      = rawFilters.status
  if (typeof rawFilters.priority    === "string") filters.priority    = rawFilters.priority
  if (typeof rawFilters.category    === "string") filters.category    = rawFilters.category
  if (typeof rawFilters.search      === "string") filters.search      = rawFilters.search.slice(0, 200)
  if (typeof rawFilters.locationId  === "string") filters.locationId  = rawFilters.locationId
  if (rawFilters.isEscalated === true)            filters.isEscalated = true

  const rawColumns = Array.isArray(body.columns) ? body.columns as string[] : null
  const columns: IssueColumnKey[] | null = rawColumns
    ? rawColumns.filter((c): c is IssueColumnKey => (ISSUE_COLUMN_KEYS as readonly string[]).includes(c))
    : null

  const sortValue = typeof body.sort === "string"
    ? VIEW_SORT_OPTIONS.find(o => o.value === body.sort)
    : null
  const sortField = sortValue ? sortValue.field : null
  const sortDir   = sortValue ? sortValue.dir   : null

  const showInSidebar = body.showInSidebar === true
  const sidebarOrder  = typeof body.sidebarOrder === "number" ? Math.max(0, body.sidebarOrder) : 0

  return { name, icon, filters, columns, sortField, sortDir, showInSidebar, sidebarOrder }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const views = await prisma.customView.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ sidebarOrder: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json(views)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Custom views are not available on Wash Essentials" }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const parsed = parseViewBody(body)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { name, icon, filters, columns, sortField, sortDir, showInSidebar, sidebarOrder } = parsed

  const view = await prisma.customView.create({
    data: {
      organizationId: session.organizationId,
      sourceType:     "issues",
      name,
      icon,
      filters:        toInput(filters),
      columns:        columns ? toInput(columns) : Prisma.DbNull,
      sortField,
      sortDir,
      showInSidebar,
      sidebarOrder,
      createdBy:      session.userId,
    },
  })

  await prisma.workspaceChangeLog.create({
    data: {
      organizationId: session.organizationId,
      changedBy:      session.userId,
      changeType:     "customView.create",
      before:         Prisma.DbNull,
      after:          toInput({ id: view.id, name: view.name }),
    },
  })

  return NextResponse.json(view)
}
