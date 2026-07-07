import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// DELETE /api/conversations/[id]/messages/[msgId] — soft-delete own message
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, msgId } = await params

  const message = await prisma.chatMessage.findFirst({
    where: { id: msgId, conversationId: id },
  })
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (message.senderId !== session.userId) {
    return NextResponse.json({ error: "Can only delete your own messages" }, { status: 403 })
  }

  await prisma.chatMessage.update({
    where: { id: msgId },
    data:  { isDeleted: true, body: "" },
  })

  return NextResponse.json({ ok: true })
}
