import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { name, category, priority, descriptionTemplate } = await request.json()

  const existing = await prisma.issueTemplate.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const template = await prisma.issueTemplate.update({
    where: { id },
    data: {
      name:                name ?? existing.name,
      category:            category ?? null,
      priority:            priority ?? null,
      descriptionTemplate: descriptionTemplate ?? null,
    },
  })

  return NextResponse.json(template)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const existing = await prisma.issueTemplate.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.issueTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
