import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { issueIds, action, value } = await request.json() as {
    issueIds: string[]
    action: "status" | "assignee" | "priority"
    value: string | null
  }

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return NextResponse.json({ error: "No issues selected" }, { status: 400 })
  }

  // Verify all issues belong to this org
  const count = await prisma.issue.count({
    where: { id: { in: issueIds }, organizationId: session.organizationId },
  })
  if (count !== issueIds.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (action === "status")   data.status = value
  if (action === "priority") data.priority = value
  if (action === "assignee") data.assignedToId = value || null

  await prisma.issue.updateMany({
    where: { id: { in: issueIds }, organizationId: session.organizationId },
    data,
  })

  return NextResponse.json({ updated: issueIds.length })
}
