import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const region = await prisma.region.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!region) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { name?: string; description?: string }
  const updated = await prisma.region.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? region.name,
      description: body.description !== undefined ? (body.description?.trim() || null) : region.description,
    },
  })

  return NextResponse.json({ region: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const region = await prisma.region.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!region) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Unassign locations from this region before deleting
  await prisma.location.updateMany({
    where: { regionId: id, organizationId: session.organizationId },
    data: { regionId: null },
  })
  await prisma.user.updateMany({
    where: { regionId: id, organizationId: session.organizationId },
    data: { regionId: null },
  })
  await prisma.region.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
