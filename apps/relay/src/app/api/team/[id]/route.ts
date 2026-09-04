import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const user = await prisma.user.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? user.name,
      role: body.role ?? user.role,
      phone: body.phone ?? user.phone,
      isActive: body.isActive ?? user.isActive,
      departmentId: body.departmentId ?? user.departmentId,
      locationId: body.locationId ?? user.locationId,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  return NextResponse.json(updated)
}
