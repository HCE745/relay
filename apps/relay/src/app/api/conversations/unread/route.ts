import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ count: 0 })

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: session.userId },
    include: {
      conversation: {
        include: {
          messages: {
            where:   { isDeleted: false, senderId: { not: session.userId } },
            orderBy: { createdAt: "desc" },
            take:    1,
          },
        },
      },
    },
  })

  let count = 0
  for (const m of memberships) {
    const last = m.conversation.messages[0]
    if (last && (!m.lastReadAt || last.createdAt > m.lastReadAt)) {
      count++
    }
  }

  // Also count unread support reply notifications
  const unreadSupportNotifs = await prisma.notification.count({
    where: { userId: session.userId, type: "NEW_MESSAGE", isRead: false },
  })

  return NextResponse.json({ count: count + unreadSupportNotifs })
}
