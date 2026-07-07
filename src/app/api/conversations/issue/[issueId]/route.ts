import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/conversations/issue/[issueId] — get or create issue conversation
export async function GET(_: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { issueId } = await params

  // Verify issue belongs to org
  const issue = await prisma.issue.findFirst({
    where:  { id: issueId, organizationId: session.organizationId },
    select: { id: true, assignedToId: true, reportedById: true, organizationId: true },
  })
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  // Find or create conversation
  let conversation = await prisma.conversation.findUnique({
    where:   { issueId },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: {
        where:   { isDeleted: false },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take:    200,
      },
    },
  })

  if (!conversation) {
    const defaultMembers = Array.from(new Set([
      session.userId,
      issue.reportedById,
      ...(issue.assignedToId ? [issue.assignedToId] : []),
    ]))

    conversation = await prisma.conversation.create({
      data: {
        orgId:       issue.organizationId,
        type:        "issue",
        issueId,
        createdById: session.userId,
        members:     { create: defaultMembers.map(uid => ({ userId: uid })) },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
        messages: {
          where:   { isDeleted: false },
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  } else {
    // Ensure current user is a member
    const isMember = conversation.members.some(m => m.userId === session.userId)
    if (!isMember) {
      await prisma.conversationMember.create({
        data: { conversationId: conversation.id, userId: session.userId },
      })
      conversation = await prisma.conversation.findUnique({
        where:   { issueId },
        include: {
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
          messages: {
            where:   { isDeleted: false },
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" },
            take:    200,
          },
        },
      })
    }
  }

  // Mark as read
  await prisma.conversationMember.updateMany({
    where: { conversationId: conversation!.id, userId: session.userId },
    data:  { lastReadAt: new Date() },
  })

  return NextResponse.json({ conversation })
}
