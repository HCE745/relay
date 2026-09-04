import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const { id } = await params

  const alert = await prisma.trendAlert.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 })

  const updated = await prisma.trendAlert.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedById: session.userId,
    },
  })

  return NextResponse.json(updated)
}
