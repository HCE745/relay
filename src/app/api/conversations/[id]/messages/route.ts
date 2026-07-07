import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"

const MSG_INCLUDE = {
  sender:    { select: { id: true, name: true, role: true } },
  reactions: { include: { user: { select: { id: true, name: true } } } },
  replyTo:   {
    select: {
      id: true, body: true, isDeleted: true,
      sender: { select: { id: true, name: true } },
    },
  },
} as const

// GET /api/conversations/[id]/messages?since=ISO&limit=100
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }         = await params
  const { searchParams } = new URL(req.url)
  const since          = searchParams.get("since")
  const limit          = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.userId } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    include: MSG_INCLUDE,
    orderBy: { createdAt: "asc" },
    take:    limit,
  })

  const typingMembers = await prisma.conversationMember.findMany({
    where: {
      conversationId: id,
      userId:         { not: session.userId },
      isTypingUntil:  { gt: new Date() },
    },
    include: { user: { select: { id: true, name: true } } },
  })

  const allMembers = await prisma.conversationMember.findMany({
    where:   { conversationId: id },
    include: { user: { select: { id: true, name: true } } },
  })

  const lastMsg = messages.filter(m => !m.isDeleted).at(-1)
  const seenBy  = lastMsg
    ? allMembers.filter(m => m.lastReadAt && m.lastReadAt >= lastMsg.createdAt && m.userId !== lastMsg.senderId)
    : []

  return NextResponse.json({
    messages:    messages.map(normalizeMsg),
    typingNames: typingMembers.map(m => m.user.name),
    seenBy:      seenBy.map(m => ({ id: m.userId, name: m.user.name })),
  })
}

// POST /api/conversations/[id]/messages — send a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { body, attachmentUrl, attachmentName, attachmentType, replyToId, mentionIds } = await req.json() as {
    body:            string
    attachmentUrl?:  string
    attachmentName?: string
    attachmentType?: string
    replyToId?:      string
    mentionIds?:     string[]
  }

  if (!body?.trim() && !attachmentUrl) {
    return NextResponse.json({ error: "Message body or attachment required" }, { status: 400 })
  }

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.userId } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const conversation = await prisma.conversation.findUnique({
    where:   { id },
    include: { members: { include: { user: { select: { id: true, organizationId: true, email: true, name: true } } } } },
  })
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (conversation.isArchived) return NextResponse.json({ error: "Conversation is archived" }, { status: 403 })

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: id,
        senderId:       session.userId,
        body:           body?.trim() ?? "",
        attachmentUrl:  attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
        attachmentType: attachmentType ?? null,
        replyToId:      replyToId ?? null,
      },
      include: MSG_INCLUDE,
    }),
    prisma.conversation.update({
      where: { id },
      data:  { updatedAt: new Date() },
    }),
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: session.userId } },
      data:  { isTypingUntil: null, lastReadAt: new Date() },
    }),
  ])

  // Notify other members (fire-and-forget)
  notifyMembers(conversation, session.userId, session.name ?? "Someone", body?.trim() ?? "📎 Attachment", mentionIds ?? []).catch(console.error)

  return NextResponse.json({ message: normalizeMsg(message) })
}

function normalizeMsg(m: {
  id: string; conversationId: string; senderId: string; body: string
  attachmentUrl: string | null; attachmentName: string | null; attachmentType: string | null
  isDeleted: boolean; replyToId: string | null; createdAt: Date; updatedAt: Date
  sender: { id: string; name: string; role: string }
  reactions: { id: string; emoji: string; userId: string; user: { id: string; name: string } }[]
  replyTo: { id: string; body: string; isDeleted: boolean; sender: { id: string; name: string } } | null
}) {
  return {
    ...m,
    body:      m.isDeleted ? "" : m.body,
    reactions: groupReactions(m.reactions),
    replyTo:   m.replyTo ? {
      id:        m.replyTo.id,
      body:      m.replyTo.isDeleted ? "" : m.replyTo.body,
      isDeleted: m.replyTo.isDeleted,
      sender:    m.replyTo.sender,
    } : null,
  }
}

function groupReactions(raw: { emoji: string; userId: string; user: { id: string; name: string } }[]) {
  const map = new Map<string, { emoji: string; count: number; userIds: string[]; names: string[] }>()
  for (const r of raw) {
    const entry = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [], names: [] }
    entry.count++
    entry.userIds.push(r.userId)
    entry.names.push(r.user.name)
    map.set(r.emoji, entry)
  }
  return Array.from(map.values())
}

async function notifyMembers(
  conversation: { id: string; type: string; orgId: string; members: { userId: string; user: { id: string; organizationId: string } }[] },
  senderId: string,
  senderName: string,
  preview: string,
  mentionIds: string[],
) {
  const others = conversation.members.filter(m => m.userId !== senderId)
  if (!others.length) return

  // In-app notifications for all members
  await prisma.notification.createMany({
    data: others.map(m => ({
      userId:         m.userId,
      organizationId: m.user.organizationId,
      type:           "NEW_MESSAGE",
      title:          `New message from ${senderName}`,
      message:        preview.slice(0, 100),
    })),
    skipDuplicates: true,
  })

  // Push notifications for all members
  await Promise.allSettled(
    others.map(m => sendPushNotification(m.userId, `New message from ${senderName}`, preview.slice(0, 100), { conversationId: conversation.id }))
  )

  // Extra notifications for @mentions
  const mentionOthers = mentionIds.filter(uid => uid !== senderId)
  if (mentionOthers.length > 0) {
    const mentionedUsers = await prisma.user.findMany({
      where: { id: { in: mentionOthers }, organizationId: conversation.orgId },
      select: { id: true, organizationId: true },
    })
    await prisma.notification.createMany({
      data: mentionedUsers.map(u => ({
        userId:         u.id,
        organizationId: u.organizationId,
        type:           "NEW_MESSAGE",
        title:          `${senderName} mentioned you`,
        message:        preview.slice(0, 100),
      })),
      skipDuplicates: true,
    })
  }
}
