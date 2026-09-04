import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// POST /api/conversations/[id]/messages/[msgId]/react — toggle emoji reaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, msgId } = await params
  const { emoji } = await req.json() as { emoji: string }
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 })

  // Verify membership
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.userId } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  // Toggle: if reaction exists delete it, otherwise create it
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: msgId, userId: session.userId, emoji } },
  })

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } })
    return NextResponse.json({ toggled: "removed" })
  }

  await prisma.messageReaction.create({
    data: { messageId: msgId, userId: session.userId, emoji },
  })
  return NextResponse.json({ toggled: "added" })
}
