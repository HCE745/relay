import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const announcement = await prisma.announcement.findFirst({
    where: { id, orgId: session.organizationId },
  })
  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.announcementAcknowledgment.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.userId } },
    create: { announcementId: id, userId: session.userId },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
