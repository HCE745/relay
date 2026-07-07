import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { content } = await req.json() as { content?: string }
  if (!content?.trim()) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 })
  }

  const note = await prisma.orgNote.create({
    data: {
      organizationId: org.id,
      content:        content.trim(),
      superAdminId:   session.superAdminId,
      superAdminName: session.name,
    },
  })

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action:     "ADD_NOTE",
    orgId:      org.id,
    orgName:    org.name,
    targetType: "organization",
    targetId:   org.id,
    targetName: org.name,
    after: { noteId: note.id, preview: content.trim().slice(0, 100) },
  })

  return NextResponse.json(note)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { noteId } = await req.json() as { noteId?: string }
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 })

  await prisma.orgNote.deleteMany({ where: { id: noteId, organizationId: id } })
  return NextResponse.json({ success: true })
}
