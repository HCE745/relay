import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { routedToUserId, routedNote } = await request.json()

  if (!routedToUserId) return NextResponse.json({ error: "Target user is required" }, { status: 400 })

  const existing = await prisma.suggestion.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Allow admins/HR to reassign, or allow the current routed user to forward it
  const isAdmin = session.role === "ADMIN" || session.role === "HR"
  const isRoutedUser = existing.routedToUserId === session.userId
  if (!isAdmin && !isRoutedUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: {
      routedToUserId,
      routedNote: routedNote || null,
      status: "PENDING",
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(suggestion)
}
