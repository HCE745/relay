import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const sop = await prisma.sOP.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      department: { select: { id: true, name: true } },
      issues: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          sopViolation: true,
          sopMatchConfidence: true,
          sopViolationNote: true,
          createdAt: true,
          resolvedAt: true,
          reportedBy: { select: { id: true, name: true } },
          asset: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { issues: true } },
    },
  })

  if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(sop)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { title, description, category, departmentId, assetType, content, version, isActive } = body

  const sop = await prisma.sOP.updateMany({
    where: { id, organizationId: session.organizationId },
    data: {
      ...(title        !== undefined ? { title: title.trim() }                       : {}),
      ...(description  !== undefined ? { description: description?.trim() || null }  : {}),
      ...(category     !== undefined ? { category: category || null }                : {}),
      ...(departmentId !== undefined ? { departmentId: departmentId || null }        : {}),
      ...(assetType    !== undefined ? { assetType: assetType || null }              : {}),
      ...(content      !== undefined ? { content: content.trim() }                  : {}),
      ...(version      !== undefined ? { version: version.trim() }                  : {}),
      ...(isActive     !== undefined ? { isActive }                                 : {}),
    },
  })

  if (sop.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.sOP.findUnique({
    where: { id },
    include: { department: { select: { id: true, name: true } }, _count: { select: { issues: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const result = await prisma.sOP.updateMany({
    where: { id, organizationId: session.organizationId },
    data: { isActive: false },
  })

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
