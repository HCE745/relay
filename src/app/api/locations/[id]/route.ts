import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const loc = await prisma.location.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.location.update({
    where: { id },
    data: {
      name:            body.name     ?? loc.name,
      address:         body.address  ?? loc.address,
      city:            body.city     ?? loc.city,
      state:           body.state    ?? loc.state,
      country:         body.country  ?? loc.country,
      parentId:        body.parentId || null,
      safetyContactId: body.safetyContactId || null,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const loc = await prisma.location.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.location.delete({ where: { id } })

  // Archive the channel for this location
  await prisma.conversation.updateMany({
    where: { channelRefType: "location", channelRefId: id },
    data:  { isArchived: true },
  })

  return NextResponse.json({ success: true })
}
