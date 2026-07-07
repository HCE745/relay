import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const {
    name, description, isActive,
    condCategory, condLocationId, condDeptId, condAssetType, condPriority,
    assignToUserId, assignToRole,
  } = body

  const existing = await prisma.routingRule.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rule = await prisma.routingRule.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      description: description !== undefined ? (description || null) : existing.description,
      isActive: isActive ?? existing.isActive,
      condCategory: condCategory !== undefined ? (condCategory || null) : existing.condCategory,
      condLocationId: condLocationId !== undefined ? (condLocationId || null) : existing.condLocationId,
      condDeptId: condDeptId !== undefined ? (condDeptId || null) : existing.condDeptId,
      condAssetType: condAssetType !== undefined ? (condAssetType || null) : existing.condAssetType,
      condPriority: condPriority !== undefined ? (condPriority || null) : existing.condPriority,
      assignToUserId: assignToUserId !== undefined ? (assignToUserId || null) : existing.assignToUserId,
      assignToRole: assignToRole !== undefined ? (assignToRole || null) : existing.assignToRole,
    },
    include: {
      condLocation: { select: { id: true, name: true } },
      condDept: { select: { id: true, name: true } },
      assignToUser: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(rule)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.routingRule.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.routingRule.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
