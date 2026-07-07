import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params
  const { noteText } = await req.json() as { noteText: string }
  if (!noteText?.trim()) return NextResponse.json({ error: "Note text required" }, { status: 400 })

  const note = await prisma.crmNote.create({
    data: {
      organizationId:  orgId,
      noteText:        noteText.trim(),
      createdBySAName: session.name,
    },
  })

  await prisma.crmActivity.create({
    data: {
      organizationId:  orgId,
      eventType:       "crm_note_added",
      description:     `CRM note added by ${session.name}`,
      createdBySAName: session.name,
    },
  })

  return NextResponse.json({ note })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params
  const { noteId } = await req.json() as { noteId: string }

  await prisma.crmNote.deleteMany({
    where: { id: noteId, organizationId: orgId },
  })

  return NextResponse.json({ ok: true })
}
