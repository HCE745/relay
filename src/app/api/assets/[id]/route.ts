import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const asset = await prisma.asset.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      location: true,
      department: true,
      vendor: true,
      issues: { orderBy: { createdAt: "desc" }, take: 10, include: { reportedBy: { select: { name: true } } } },
      maintenanceLogs: { orderBy: { performedAt: "desc" }, include: { vendor: { select: { name: true } } } },
    },
  })
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(asset)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const asset = await prisma.asset.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.asset.update({
    where: { id },
    data: {
      name: body.name || asset.name,
      assetTag: body.assetTag ?? asset.assetTag,
      type: body.type ?? asset.type,
      status: body.status ?? asset.status,
      manufacturer: body.manufacturer ?? asset.manufacturer,
      model: body.model ?? asset.model,
      serialNumber: body.serialNumber ?? asset.serialNumber,
      notes: body.notes ?? asset.notes,
      locationId: body.locationId ?? asset.locationId,
      departmentId: body.departmentId ?? asset.departmentId,
      vendorId: body.vendorId ?? asset.vendorId,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : asset.purchaseDate,
      warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : asset.warrantyExpiry,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const asset = await prisma.asset.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.asset.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
