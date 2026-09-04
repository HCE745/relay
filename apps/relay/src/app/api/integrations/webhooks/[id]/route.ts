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
  const ep = await prisma.webhookEndpoint.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { isActive?: boolean; events?: string[] }
  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.events !== undefined && { events: body.events }),
    },
  })

  return NextResponse.json({ endpoint: updated })
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
  const ep = await prisma.webhookEndpoint.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.webhookEndpoint.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
