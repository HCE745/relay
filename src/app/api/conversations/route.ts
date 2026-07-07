import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/conversations — list user's conversations with real unread counts
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: session.userId, conversation: { isArchived: false } },
    include: {
      conversation: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, role: true } } },
          },
          messages: {
            where:   { isDeleted: false },
            orderBy: { createdAt: "desc" },
            take:    1,
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  })

  const conversations = await Promise.all(
    memberships
      .filter(m => m.conversation != null)
      .map(async m => {
        const conv    = m.conversation!
        const lastMsg = conv.messages[0] ?? null

        // Real unread count: messages after lastReadAt from others
        const unread = await prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            isDeleted:      false,
            senderId:       { not: session.userId },
            createdAt:      m.lastReadAt ? { gt: m.lastReadAt } : undefined,
          },
        })

        const otherMember = conv.type === "direct"
          ? conv.members.find(cm => cm.userId !== session.userId)
          : null

        return {
          id:         conv.id,
          type:       conv.type,
          name:       conv.name ?? otherMember?.user.name ?? "Unnamed",
          members:    conv.members.map(cm => ({ ...cm.user, isAdmin: cm.isAdmin })),
          lastMessage: lastMsg
            ? { body: lastMsg.isDeleted ? "Message deleted" : lastMsg.body, sender: lastMsg.sender.name, at: lastMsg.createdAt }
            : null,
          unread,
          updatedAt:  conv.updatedAt,
          isArchived: conv.isArchived,
          channelRefType: conv.channelRefType,
          channelRefId:   conv.channelRefId,
          issueId:        conv.issueId,
        }
      })
  )

  return NextResponse.json({ conversations: conversations.filter(Boolean) })
}

// POST /api/conversations — create a conversation
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { type, name, memberIds, isAdmin } = await req.json() as {
    type:       "direct" | "group" | "channel"
    name?:      string
    memberIds:  string[]
    isAdmin?:   boolean  // whether creator is admin in group
  }

  if (!type || !memberIds?.length) {
    return NextResponse.json({ error: "type and memberIds required" }, { status: 400 })
  }

  // Verify all members are in the same org
  const allMemberIds = Array.from(new Set([session.userId, ...memberIds]))
  const verifiedUsers = await prisma.user.findMany({
    where: { id: { in: allMemberIds }, organizationId: session.organizationId },
    select: { id: true },
  })
  if (verifiedUsers.length !== allMemberIds.length) {
    return NextResponse.json({ error: "Some members are not in your organization" }, { status: 400 })
  }

  // For direct messages, return existing if one exists
  if (type === "direct" && memberIds.length === 1) {
    const other = memberIds[0]!
    const existing = await prisma.conversation.findFirst({
      where: {
        orgId:   session.organizationId,
        type:    "direct",
        AND: [
          { members: { some: { userId: session.userId } } },
          { members: { some: { userId: other } } },
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    })
    if (existing && existing.members.length === 2) {
      return NextResponse.json({ conversation: existing, existing: true })
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      orgId:       session.organizationId,
      type,
      name:        name?.trim() || null,
      createdById: session.userId,
      members: {
        create: allMemberIds.map(uid => ({
          userId:  uid,
          isAdmin: (uid === session.userId && isAdmin) || false,
        })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
    },
  })

  return NextResponse.json({ conversation })
}
