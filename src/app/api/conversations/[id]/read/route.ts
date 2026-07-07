import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await prisma.conversationMember.updateMany({
    where: { conversationId: id, userId: session.userId },
    data:  { lastReadAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
