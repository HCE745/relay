import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, acknowledgedAt: true },
  })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (issue.acknowledgedAt) return NextResponse.json({ error: "Already acknowledged" }, { status: 409 })

  const now = new Date()
  await prisma.$transaction([
    prisma.issue.update({
      where: { id },
      data: { acknowledgedAt: now, acknowledgedById: session.userId },
    }),
    prisma.issueHistory.create({
      data: {
        issueId:     id,
        field:       "acknowledgedAt",
        oldValue:    null,
        newValue:    `Acknowledged by ${session.name ?? session.email}`,
        changedById: session.userId,
      },
    }),
  ])

  return NextResponse.json({ ok: true, acknowledgedAt: now.toISOString() })
}
