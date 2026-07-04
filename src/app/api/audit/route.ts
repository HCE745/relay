import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const tenantId = session.tenantId

  const { searchParams } = new URL(req.url)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")
  const startDate = startDateParam ? new Date(startDateParam) : thirtyDaysAgo
  const endDate = endDateParam ? new Date(endDateParam) : now

  // Set endDate to end of day
  if (endDateParam) {
    endDate.setHours(23, 59, 59, 999)
  }

  const userIdParam = searchParams.get("userId") ?? undefined
  const actionParam = searchParams.get("action") ?? undefined
  const tableNameParam = searchParams.get("tableName") ?? undefined
  const recordIdParam = searchParams.get("recordId") ?? undefined

  const pageRaw = parseInt(searchParams.get("page") ?? "1")
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSizeRaw = parseInt(searchParams.get("pageSize") ?? "50")
  const pageSize = isNaN(pageSizeRaw) || pageSizeRaw < 1 ? 50 : Math.min(pageSizeRaw, 200)

  // Resolve entityId from param or cookie
  let entityId: string | undefined = searchParams.get("entityId") ?? undefined
  if (!entityId) {
    entityId = await getSelectedEntityId()
  }

  // Verify entityId belongs to the tenant
  if (entityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: entityId, tenantId },
      select: { id: true },
    })
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 })
    }
  }

  const where = {
    tenantId,
    ...(entityId ? { entityId } : {}),
    ...(userIdParam ? { userId: userIdParam } : {}),
    ...(actionParam ? { action: actionParam } : {}),
    ...(tableNameParam ? { tableName: tableNameParam } : {}),
    ...(recordIdParam ? { recordId: recordIdParam } : {}),
    createdAt: { gte: startDate, lte: endDate },
  }

  const [total, rawLogs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const logs = rawLogs.map((log) => ({
    id: log.id,
    tenantId: log.tenantId,
    entityId: log.entityId,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    beforeJson: log.beforeJson,
    afterJson: log.afterJson,
    createdAt: log.createdAt.toISOString(),
    userName: log.user?.name ?? log.user?.email ?? "System",
  }))

  return NextResponse.json({ logs, total, page, pageSize })
}
