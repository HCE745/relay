export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isRep) return NextResponse.json({ error: "Only managers can edit templates" }, { status: 403 })

  const { id } = await params
  const { name, subject, body } = await req.json() as { name?: string; subject?: string; body?: string }

  try {
    const template = await prisma.crmEmailTemplate.update({
      where: { id },
      data: {
        ...(name    ? { name:    name.trim()    } : {}),
        ...(subject ? { subject: subject.trim() } : {}),
        ...(body    ? { body:    body.trim()    } : {}),
      },
    })
    return NextResponse.json({ template })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isRep) return NextResponse.json({ error: "Only managers can delete templates" }, { status: 403 })

  const { id } = await params

  const template = await prisma.crmEmailTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (template.isSystem) return NextResponse.json({ error: "System templates cannot be deleted" }, { status: 403 })

  await prisma.crmEmailTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
