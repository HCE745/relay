import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()
  const body = await req.json()

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })

  if (!po || po.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (["CLOSED", "CANCELLED"].includes(po.status)) {
    return NextResponse.json({ error: `Cannot receive against a ${po.status} PO` }, { status: 400 })
  }

  const receiptLines: { poLineId: string; qtyReceived: number }[] = body.lines ?? []
  if (receiptLines.length === 0) {
    return NextResponse.json({ error: "Receipt must have at least one line" }, { status: 400 })
  }

  // Update each PO line's qtyReceived
  const lineMap = new Map(po.lines.map((l) => [l.id, l]))
  const updates: Promise<unknown>[] = []

  for (const rl of receiptLines) {
    const line = lineMap.get(rl.poLineId)
    if (!line) continue
    const newReceived = Math.min(line.qtyReceived + rl.qtyReceived, line.qty)
    updates.push(
      prisma.purchaseOrderLine.update({
        where: { id: rl.poLineId },
        data: { qtyReceived: newReceived },
      })
    )
  }
  await Promise.all(updates)

  // Create receipt record
  await prisma.purchaseOrderReceipt.create({
    data: {
      poId: id,
      receivedBy: body.receivedBy ?? null,
      notes: body.notes ?? null,
      lines: receiptLines,
    },
  })

  // Recalculate PO status
  const refreshedLines = await prisma.purchaseOrderLine.findMany({ where: { poId: id } })
  const allReceived = refreshedLines.every((l) => l.qtyReceived >= l.qty)
  const anyReceived = refreshedLines.some((l) => l.qtyReceived > 0)
  const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: newStatus },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  })

  await writeAuditLog({
    tenantId: session.tenantId,
    entityId: po.entityId,
    userId: session.userId,
    action: "RECEIVE",
    tableName: "hce_purchase_orders",
    recordId: id,
    before: { status: po.status },
    after: { status: newStatus, lines: receiptLines },
  })

  return NextResponse.json(updated)
}
