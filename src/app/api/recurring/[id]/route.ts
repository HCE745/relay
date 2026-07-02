import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const template = await prisma.recurringTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { runs: { orderBy: { runAt: "desc" }, take: 20 } },
  })

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(template)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params
  const body = await req.json()

  const template = await prisma.recurringTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.recurringTemplate.update({
    where: { id },
    data: {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const template = await prisma.recurringTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.recurringRun.deleteMany({ where: { templateId: id } })
  await prisma.recurringTemplate.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
