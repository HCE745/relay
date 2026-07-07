import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  const briefings = await prisma.executiveBriefing.findMany({
    where: {
      organizationId: session.organizationId,
      ...(type ? { briefingType: type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return NextResponse.json(briefings)
}
