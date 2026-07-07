import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const rel = await prisma.organizationRelationship.findFirst({
    where: {
      id,
      OR: [{ orgIdA: session.organizationId }, { orgIdB: session.organizationId }],
    },
  })
  if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { status?: string }
  const updated = await prisma.organizationRelationship.update({
    where: { id },
    data: { ...(body.status !== undefined && { status: body.status }) },
  })

  return NextResponse.json({ relationship: updated })
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
  const rel = await prisma.organizationRelationship.findFirst({
    where: {
      id,
      OR: [{ orgIdA: session.organizationId }, { orgIdB: session.organizationId }],
    },
  })
  if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.organizationRelationship.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
