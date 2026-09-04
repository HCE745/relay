import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      receipts: { orderBy: { receivedAt: "desc" } },
    },
  })

  if (!po || po.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Load matched bills separately
  const bills = await prisma.bill.findMany({
    where: { tenantId: session.tenantId, poId: id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { id: "asc" } },
    },
    orderBy: { date: "desc" },
  })

  return NextResponse.json({ ...po, bills })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()
  const body = await req.json()

  const po = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!po || po.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const entityDeny = assertEntityAccess(session, po.entityId); if (entityDeny) return entityDeny

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["OPEN"],
    OPEN: ["CLOSED", "CANCELLED"],
    PARTIALLY_RECEIVED: ["CLOSED", "CANCELLED"],
  }

  const updates: Record<string, unknown> = {}
  if ("notes" in body) updates.notes = body.notes ?? null

  if ("status" in body && body.status !== po.status) {
    const allowed = validTransitions[po.status] ?? []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${po.status} to ${body.status}` },
        { status: 400 }
      )
    }
    updates.status = body.status
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: updates,
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  })

  if ("status" in updates) {
    await writeAuditLog({
      tenantId: session.tenantId,
      entityId: po.entityId,
      userId: session.userId,
      action: "STATUS_CHANGE",
      tableName: "hce_purchase_orders",
      recordId: id,
      before: { status: po.status },
      after: { status: updates.status },
    })
  }

  return NextResponse.json(updated)
}
