import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rules = await prisma.routingRule.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      condLocation: { select: { id: true, name: true } },
      condDept: { select: { id: true, name: true } },
      assignToUser: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(rules)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, description, isActive,
    condCategory, condLocationId, condDeptId, condAssetType, condPriority,
    assignToUserId, assignToRole,
  } = body

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!assignToUserId && !assignToRole) {
    return NextResponse.json({ error: "Must specify either assignToUserId or assignToRole" }, { status: 400 })
  }

  const rule = await prisma.routingRule.create({
    data: {
      organizationId: session.organizationId,
      name,
      description: description || null,
      isActive: isActive ?? true,
      condCategory: condCategory || null,
      condLocationId: condLocationId || null,
      condDeptId: condDeptId || null,
      condAssetType: condAssetType || null,
      condPriority: condPriority || null,
      assignToUserId: assignToUserId || null,
      assignToRole: assignToRole || null,
    },
    include: {
      condLocation: { select: { id: true, name: true } },
      condDept: { select: { id: true, name: true } },
      assignToUser: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(rule, { status: 201 })
}
