import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push-notifications"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { content, isInternal, mentionedUserIds } = await request.json()

  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const issue = await prisma.issue.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const comment = await prisma.issueComment.create({
    data: { content, issueId: id, authorId: session.userId, isInternal: isInternal ?? false },
    include: { author: { select: { id: true, name: true } } },
  })

  // Build notification recipients: assignee + @mentioned users
  const notifySet = new Set<string>()
  if (issue.assignedToId && issue.assignedToId !== session.userId) {
    notifySet.add(issue.assignedToId)
  }

  const mentionIds: string[] = Array.isArray(mentionedUserIds) ? mentionedUserIds : []
  if (mentionIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: mentionIds }, organizationId: session.organizationId, isActive: true },
      select: { id: true },
    })
    validUsers.forEach(u => { if (u.id !== session.userId) notifySet.add(u.id) })
  }

  if (notifySet.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(notifySet).map(uid => ({
        userId:         uid,
        organizationId: session.organizationId,
        issueId:        id,
        type:           mentionIds.includes(uid) ? "MENTION" : "ISSUE_UPDATED",
        title:          mentionIds.includes(uid) ? `${session.name} mentioned you` : "New Comment",
        message:        mentionIds.includes(uid)
          ? `${session.name} mentioned you in a comment on: ${issue.title}`
          : `${session.name} commented on: ${issue.title}`,
      })),
      skipDuplicates: true,
    })
  }

  // Fire push notifications alongside in-app (non-blocking)
  for (const uid of notifySet) {
    const isMention = mentionIds.includes(uid)
    void sendPushNotification(
      uid,
      isMention ? `${session.name} mentioned you` : "New Comment",
      isMention
        ? `${session.name} mentioned you in: ${issue.title}`
        : `${session.name} commented on: ${issue.title}`,
      { url: `/issues/${id}`, issueId: id },
    )
  }

  return NextResponse.json(comment, { status: 201 })
}
