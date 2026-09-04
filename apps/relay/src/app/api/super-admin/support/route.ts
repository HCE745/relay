import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET /api/super-admin/support?status=open|all — list support conversations
export async function GET(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const status = new URL(req.url).searchParams.get("status") ?? "open"

  const conversations = await prisma.supportConversation.findMany({
    where: status === "all" ? {} : { status },
    include: {
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take:    1,
        include: { senderUser: { select: { name: true } } },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  })

  const withUnread = conversations.map(c => {
    const lastMsg = c.messages[0]
    const unread  = lastMsg?.senderType === "user" && !lastMsg.isRead ? 1 : 0
    return { ...c, unread }
  })

  return NextResponse.json({ conversations: withUnread })
}
