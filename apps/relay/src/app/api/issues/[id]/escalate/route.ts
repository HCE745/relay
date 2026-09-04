import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail, issueEscalatedEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { reason } = await request.json()

  const issue = await prisma.issue.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fromLevel = issue.escalationLevel
  const toLevel = fromLevel + 1

  const updated = await prisma.issue.update({
    where: { id },
    data: {
      escalationLevel: toLevel,
      isEscalated: true,
      status: "ESCALATED",
      lastEscalatedAt: new Date(),
    },
  })

  await prisma.issueEscalation.create({
    data: { issueId: id, fromLevel, toLevel, reason },
  })

  await prisma.issueHistory.create({
    data: {
      issueId: id,
      field: "escalationLevel",
      oldValue: String(fromLevel),
      newValue: String(toLevel),
      changedById: session.userId,
    },
  })

  // Notify assignee (if any) and org admins about the escalation
  const fullIssue = await prisma.issue.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  const escalatorName = session.name
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const issueUrl = `${appUrl}/issues/${id}`

  const notifyEmails: string[] = []
  if (fullIssue?.assignedTo?.email) notifyEmails.push(fullIssue.assignedTo.email)

  // Also notify admins/managers if this is a high escalation level
  if (toLevel >= 2) {
    const admins = await prisma.user.findMany({
      where: { organizationId: session.organizationId, role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
      select: { email: true },
    })
    admins.forEach(a => { if (a.email && !notifyEmails.includes(a.email)) notifyEmails.push(a.email) })
  }

  for (const email of notifyEmails) {
    sendEmail({
      to:      email,
      subject: `Issue escalated: ${issue.title}`,
      html:    issueEscalatedEmail({
        recipientName:   fullIssue?.assignedTo?.name ?? "Team",
        escalatedByName: escalatorName,
        issueTitle:      issue.title,
        issueUrl,
        reason,
        toLevel,
        currentStatus:   updated.status,
      }),
    }).catch(console.error)
  }

  return NextResponse.json(updated)
}
