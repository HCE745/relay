export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Reps can only add notes to their own assigned prospects
  const prospect = await prisma.prospect.findUnique({ where: { id }, select: { id: true, assignedToId: true } })
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!info.isManager && !info.isSuperAdmin && prospect.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json() as { noteText?: string }
  if (!body.noteText?.trim()) return NextResponse.json({ error: "noteText required" }, { status: 400 })

  const note = await prisma.prospectNote.create({
    data: { prospectId: id, noteText: body.noteText.trim() },
  })

  return NextResponse.json({ note }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params
  const body = await req.json() as { noteId: string }
  if (!body.noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 })

  const note = await prisma.prospectNote.findUnique({ where: { id: body.noteId }, select: { prospectId: true } })
  if (!note || note.prospectId !== prospectId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reps can only delete notes on their own assigned prospects
  if (!info.isManager && !info.isSuperAdmin) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { assignedToId: true } })
    if (!prospect || prospect.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }

  await prisma.prospectNote.delete({ where: { id: body.noteId } })
  return NextResponse.json({ ok: true })
}
