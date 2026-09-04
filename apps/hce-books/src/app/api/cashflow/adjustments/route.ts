import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/cashflow/adjustments?entityId=...
export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? ""

  // Verify entity belongs to tenant
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId: session.tenantId },
  })
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const adjustments = await prisma.cashForecastAdjustment.findMany({
    where: { tenantId: session.tenantId, entityId },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(adjustments)
}

// POST /api/cashflow/adjustments
// Body: { entityId, date, description, amountCents }
export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "write"); if (deny) return deny

  const { entityId, date, description, amountCents } = body

  if (!entityId || !date || !description || amountCents === undefined) {
    return NextResponse.json({ error: "entityId, date, description, and amountCents are required" }, { status: 400 })
  }

  // Verify entity belongs to tenant
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId: session.tenantId },
  })
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const adjustment = await prisma.cashForecastAdjustment.create({
    data: {
      tenantId: session.tenantId,
      entityId,
      date: new Date(date),
      description,
      amountCents: parseInt(amountCents, 10),
    },
  })

  return NextResponse.json(adjustment)
}

// DELETE /api/cashflow/adjustments?id=...
export async function DELETE(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id") ?? ""

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Verify ownership: the adjustment must belong to this tenant
  const existing = await prisma.cashForecastAdjustment.findFirst({
    where: { id, tenantId: session.tenantId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Adjustment not found" }, { status: 404 })
  }

  await prisma.cashForecastAdjustment.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
