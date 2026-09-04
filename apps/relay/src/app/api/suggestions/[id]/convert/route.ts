import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SUGGESTION_TO_ISSUE_CATEGORY } from "@/lib/suggestion-routing"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { title, priority, assignedToId } = await request.json()

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })

  const suggestion = await prisma.suggestion.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (suggestion.convertedToIssueId) {
    return NextResponse.json({ error: "Already converted to a work order" }, { status: 400 })
  }

  const isAdmin = session.role === "ADMIN" || session.role === "HR"
  const isRoutedUser = suggestion.routedToUserId === session.userId
  if (!isAdmin && !isRoutedUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const issueCategory = SUGGESTION_TO_ISSUE_CATEGORY[
    (suggestion.detectedCategory ?? "GENERAL") as keyof typeof SUGGESTION_TO_ISSUE_CATEGORY
  ] ?? "GENERAL"

  // Create the issue (work order)
  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      description: suggestion.content,
      priority: priority ?? "MEDIUM",
      category: issueCategory,
      status: "OPEN",
      organizationId: session.organizationId,
      reportedById: session.userId,
      assignedToId: assignedToId || suggestion.routedToUserId || null,
    },
  })

  // Mark suggestion as converted and link to the issue
  const updated = await prisma.suggestion.update({
    where: { id },
    data: {
      status: "CONVERTED",
      convertedToIssueId: issue.id,
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
    },
  })

  // Record creation in issue history
  await prisma.issueHistory.create({
    data: {
      issueId: issue.id,
      field: "status",
      oldValue: null,
      newValue: "OPEN",
      changedById: session.userId,
    },
  })

  // Notify assignee if set
  if (issue.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: issue.assignedToId,
        organizationId: session.organizationId,
        issueId: issue.id,
        type: "ISSUE_ASSIGNED",
        title: "Work Order Assigned",
        message: `A suggestion has been converted into a work order and assigned to you: ${issue.title}`,
      },
    })
  }

  return NextResponse.json({ suggestion: updated, issue: { id: issue.id, title: issue.title } })
}
