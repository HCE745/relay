import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params
  const { organizationId } = session

  const layout = await prisma.dashboardLayout.findFirst({
    where: { id, organizationId },
  })
  if (!layout) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction([
    prisma.dashboardLayout.updateMany({
      where: { organizationId, isOrgDefault: true },
      data:  { isOrgDefault: false },
    }),
    prisma.dashboardLayout.update({
      where: { id },
      data:  { isOrgDefault: true, layoutType: "ORG_DEFAULT" },
    }),
  ])

  return NextResponse.json({ ok: true })
}
