import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.issueTemplate.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, priority: true, descriptionTemplate: true, createdAt: true },
  })

  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, category, priority, descriptionTemplate } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const template = await prisma.issueTemplate.create({
    data: {
      name,
      category:            category || null,
      priority:            priority || null,
      descriptionTemplate: descriptionTemplate || null,
      organizationId:      session.organizationId,
      createdById:         session.userId,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
