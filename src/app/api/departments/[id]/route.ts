import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const d = await prisma.department.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.department.update({
    where: { id },
    data: { name: body.name ?? d.name, locationId: body.locationId ?? d.locationId },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const d = await prisma.department.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.department.delete({ where: { id } })

  // Archive the channel for this department
  await prisma.conversation.updateMany({
    where: { channelRefType: "department", channelRefId: id },
    data:  { isArchived: true },
  })

  return NextResponse.json({ success: true })
}
