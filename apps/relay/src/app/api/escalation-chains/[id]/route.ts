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
  const chain = await prisma.escalationChain.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { isActive?: boolean; name?: string; description?: string }

  const updated = await prisma.escalationChain.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  return NextResponse.json({ chain: updated })
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
  const chain = await prisma.escalationChain.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.escalationChain.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
