import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const alerts = await prisma.trendAlert.findMany({
    where: { organizationId: session.organizationId, status: "ACTIVE" },
    orderBy: { detectedAt: "desc" },
  })

  return NextResponse.json(alerts)
}
