import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const v = await prisma.vendor.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.vendor.update({
    where: { id },
    data: {
      name: body.name ?? v.name,
      contactName: body.contactName ?? v.contactName,
      email: body.email ?? v.email,
      phone: body.phone ?? v.phone,
      address: body.address ?? v.address,
      specialty: body.specialty ?? v.specialty,
      notes: body.notes ?? v.notes,
      isActive: body.isActive ?? v.isActive,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const v = await prisma.vendor.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.vendor.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
