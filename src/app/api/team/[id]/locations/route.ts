import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// GET /api/team/:id/locations — return assigned locations
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdmin = ["ADMIN", "HR"].includes(session.role)
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const userLocations = await prisma.userLocation.findMany({
    where: { userId: id },
    include: { location: { select: { id: true, name: true } } },
  })

  return NextResponse.json(userLocations.map(ul => ul.location))
}

// PUT /api/team/:id/locations — replace assigned locations { locationIds: string[] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const locationIds: string[] = body.locationIds ?? []

  // Verify all locations belong to the same org
  if (locationIds.length > 0) {
    const locs = await prisma.location.findMany({
      where: { id: { in: locationIds }, organizationId: session.organizationId },
      select: { id: true },
    })
    if (locs.length !== locationIds.length) {
      return NextResponse.json({ error: "Invalid location IDs" }, { status: 400 })
    }
  }

  // Replace all assignments in a transaction
  await prisma.$transaction([
    prisma.userLocation.deleteMany({ where: { userId: id } }),
    ...(locationIds.length > 0
      ? [prisma.userLocation.createMany({
          data: locationIds.map(locationId => ({ userId: id, locationId })),
          skipDuplicates: true,
        })]
      : []),
  ])

  return NextResponse.json({ ok: true })
}
