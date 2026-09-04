import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const asset = await prisma.asset.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { type, description, cost, performedAt, nextDueAt, vendorId } = await request.json()
  if (!type) return NextResponse.json({ error: "Type required" }, { status: 400 })

  const log = await prisma.maintenanceLog.create({
    data: {
      assetId: id,
      type,
      description: description || null,
      cost: cost ? parseFloat(cost) : null,
      performedAt: performedAt ? new Date(performedAt) : new Date(),
      nextDueAt: nextDueAt ? new Date(nextDueAt) : null,
      vendorId: vendorId || null,
    },
  })

  return NextResponse.json(log, { status: 201 })
}
