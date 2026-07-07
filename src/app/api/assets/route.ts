import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = request.nextUrl
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const locationId = searchParams.get("locationId")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = { organizationId: session.organizationId }
  if (type) where.type = type
  if (status) where.status = status
  if (locationId) where.locationId = locationId
  if (search) where.name = { contains: search }

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      location: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      _count: { select: { issues: true, maintenanceLogs: true } },
    },
  })

  return NextResponse.json(assets)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, assetTag, type, manufacturer, model, serialNumber, purchaseDate, warrantyExpiry, notes, locationId, departmentId, vendorId } = body

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const asset = await prisma.asset.create({
    data: {
      name,
      assetTag: assetTag || null,
      type: type ?? "EQUIPMENT",
      status: "OPERATIONAL",
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
      notes: notes || null,
      organizationId: session.organizationId,
      locationId: locationId || null,
      departmentId: departmentId || null,
      vendorId: vendorId || null,
    },
  })

  return NextResponse.json(asset, { status: 201 })
}
