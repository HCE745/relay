export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

async function requireSales() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserId ? s : null
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { noteText?: string }
  if (!body.noteText?.trim()) return NextResponse.json({ error: "noteText required" }, { status: 400 })

  const prospect = await prisma.prospect.findUnique({ where: { id }, select: { id: true } })
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const note = await prisma.prospectNote.create({
    data: { prospectId: id, noteText: body.noteText.trim() },
  })

  return NextResponse.json({ note }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params
  const body = await req.json() as { noteId: string }
  if (!body.noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 })

  const note = await prisma.prospectNote.findUnique({ where: { id: body.noteId }, select: { prospectId: true } })
  if (!note || note.prospectId !== prospectId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.prospectNote.delete({ where: { id: body.noteId } })
  return NextResponse.json({ ok: true })
}
