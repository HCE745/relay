export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

// GET /api/sales/alerts — list unread alerts for the current admin user
export async function GET(_req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (info.isSuperAdmin) {
    // Super admins don't have a SalesUser row — return empty
    return NextResponse.json({ alerts: [], total: 0 })
  }

  const alerts = await prisma.salesAlert.findMany({
    where: { recipientId: info.salesUserId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ alerts, total: alerts.length })
}

// PATCH /api/sales/alerts — mark alert(s) as read
export async function PATCH(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (info.isSuperAdmin) {
    return NextResponse.json({ ok: true })
  }

  const body = await req.json() as { ids?: string[]; all?: boolean }

  if (body.all) {
    await prisma.salesAlert.updateMany({
      where: { recipientId: info.salesUserId },
      data: { isRead: true },
    })
  } else if (body.ids?.length) {
    await prisma.salesAlert.updateMany({
      where: { recipientId: info.salesUserId, id: { in: body.ids } },
      data: { isRead: true },
    })
  }

  return NextResponse.json({ ok: true })
}
