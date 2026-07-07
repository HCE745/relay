import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locations = await prisma.location.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assets: true, issues: true, users: true } },
      parent: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(locations)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { name, address, city, state, country, parentId, safetyContactId } = body
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const location = await prisma.location.create({
    data: {
      name,
      address:         address || null,
      city:            city || null,
      state:           state || null,
      country:         country || null,
      parentId:        parentId || null,
      safetyContactId: safetyContactId || null,
      organizationId:  session.organizationId,
    },
  })

  // Auto-create a channel for this location
  createLocationChannel(session.organizationId, location.id, location.name).catch(console.error)

  return NextResponse.json(location, { status: 201 })
}

async function createLocationChannel(orgId: string, locationId: string, locationName: string) {
  const existing = await prisma.conversation.findFirst({
    where: { orgId, channelRefType: "location", channelRefId: locationId },
  })
  if (existing) return

  const members = await prisma.user.findMany({
    where: { organizationId: orgId, locationId },
    select: { id: true },
  })

  await prisma.conversation.create({
    data: {
      orgId,
      type:           "channel",
      name:           locationName,
      channelRefType: "location",
      channelRefId:   locationId,
      members:        { create: members.map(u => ({ userId: u.id })) },
    },
  })
}
