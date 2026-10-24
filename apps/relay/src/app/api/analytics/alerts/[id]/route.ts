import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params
  const alert = await prisma.dashboardAlert.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { isActive?: boolean; name?: string; notifyUserIds?: string[] }
  const updated = await prisma.dashboardAlert.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      ...(typeof body.name === "string"      && { name: body.name.trim() }),
      ...(Array.isArray(body.notifyUserIds)  && { notifyUserIds: body.notifyUserIds }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params
  const alert = await prisma.dashboardAlert.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.dashboardAlert.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
