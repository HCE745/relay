import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const broadcast = await prisma.emergencyBroadcast.findFirst({
    where: { id, orgId: session.organizationId },
  })
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.emergencyAcknowledgment.upsert({
    where: { emergencyBroadcastId_userId: { emergencyBroadcastId: id, userId: session.userId } },
    create: { emergencyBroadcastId: id, userId: session.userId },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
