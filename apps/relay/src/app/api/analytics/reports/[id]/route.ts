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
  const report = await prisma.dashboardReport.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { isActive?: boolean; name?: string; recipients?: string[] }
  const updated = await prisma.dashboardReport.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      ...(typeof body.name === "string"     && { name: body.name.trim() }),
      ...(Array.isArray(body.recipients)    && { recipients: body.recipients }),
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
  const report = await prisma.dashboardReport.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.dashboardReport.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
