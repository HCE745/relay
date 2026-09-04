import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }                       = await params
  const { name, subject, body }      = await req.json() as { name?: string; subject?: string; body?: string }

  const template = await prisma.crmEmailTemplate.update({
    where: { id },
    data:  {
      ...(name    ? { name:    name.trim()    } : {}),
      ...(subject ? { subject: subject.trim() } : {}),
      ...(body    ? { body:    body.trim()    } : {}),
    },
  })

  return NextResponse.json({ template })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const template = await prisma.crmEmailTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.crmEmailTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
