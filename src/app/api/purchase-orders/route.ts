import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/db"
import { cookies } from "next/headers"
import type { PoStatus } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const entityId = await getEntityId()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") as PoStatus | null
  const vendorId = searchParams.get("vendorId")

  const where: Record<string, unknown> = {
    tenantId: session.tenantId,
    entityId,
    ...(status ? { status } : {}),
    ...(vendorId ? { vendorId } : {}),
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { date: "desc" },
    take: 200,
  })

  return NextResponse.json(pos)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const entityId = await getEntityId()
  const body = await req.json()

  const {
    vendorId,
    poNumber,
    date,
    expectedDate,
    notes,
    lines,
  } = body as {
    vendorId: string
    poNumber?: string
    date: string
    expectedDate?: string
    notes?: string
    lines: { description?: string; qty: number; unitPriceCents: number; accountId?: string; sortOrder?: number }[]
  }

  if (!vendorId) return NextResponse.json({ error: "vendorId is required" }, { status: 400 })
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 })
  if (!lines || lines.length === 0) return NextResponse.json({ error: "at least one line is required" }, { status: 400 })

  // Verify vendor belongs to this tenant+entity
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, tenantId: session.tenantId, entityId },
  })
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

  // Calculate totals
  const totalCents = lines.reduce((sum, l) => sum + Math.round(l.qty * l.unitPriceCents), 0)

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: session.tenantId,
      entityId,
      vendorId,
      poNumber: poNumber ?? `PO-${Date.now()}`,
      date: new Date(date),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: notes ?? null,
      status: "DRAFT",
      totalCents,
      lines: {
        create: lines.map((l, i) => ({
          description: l.description ?? null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          amountCents: Math.round(l.qty * l.unitPriceCents),
          accountId: l.accountId ?? null,
          qtyReceived: 0,
          sortOrder: l.sortOrder ?? i,
        })),
      },
    },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  })

  await writeAuditLog({
    tenantId: session.tenantId,
    entityId,
    userId: session.userId,
    action: "CREATE",
    tableName: "hce_purchase_orders",
    recordId: po.id,
    after: { poNumber: po.poNumber, vendorId: po.vendorId, totalCents: po.totalCents },
  })

  return NextResponse.json(po, { status: 201 })
}
