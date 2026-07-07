import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const key = await prisma.apiKey.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.apiKey.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const key = await prisma.apiKey.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { isActive?: boolean }
  const updated = await prisma.apiKey.update({
    where: { id },
    data: { ...(body.isActive !== undefined && { isActive: body.isActive }) },
    select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  })

  return NextResponse.json({ key: updated })
}
