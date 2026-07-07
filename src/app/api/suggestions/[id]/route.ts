import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { status, adminNote } = await request.json()

  const existing = await prisma.suggestion.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: {
      status: status ?? existing.status,
      adminNote: adminNote !== undefined ? adminNote : existing.adminNote,
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(suggestion)
}
