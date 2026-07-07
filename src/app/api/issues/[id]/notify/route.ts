import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail, issueAssignmentEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!issue.assignedTo) return NextResponse.json({ error: "No assignee on this issue" }, { status: 400 })
  if (!issue.assignedTo.email) return NextResponse.json({ error: "Assignee has no email address" }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const issueUrl = `${appUrl}/issues/${issue.id}`

  const { ISSUE_PRIORITY } = await import("@/lib/constants")
  const priorityLabel = ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority

  const result = await sendEmail({
    to: issue.assignedTo.email,
    subject: `[Relay] Issue Assigned: ${issue.title}`,
    html: issueAssignmentEmail({
      assigneeName: issue.assignedTo.name,
      issuerName: session.name,
      issueTitle: issue.title,
      priority: priorityLabel,
      issueUrl,
      description: issue.description,
    }),
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
