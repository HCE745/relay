import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const ADMIN_ROLES = ["ADMIN", "MANAGER"]

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const policies = await prisma.approvalPolicy.findMany({
    where: { organizationId: session.organizationId },
    include: {
      rules: { orderBy: { priority: "asc" } },
      _count: { select: { catalogItems: true, purchaseRequests: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })

  return NextResponse.json(policies)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, isDefault, escalateAfterHours, rules } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  // If setting this as default, unset any existing default
  if (isDefault) {
    await prisma.approvalPolicy.updateMany({
      where: { organizationId: session.organizationId, isDefault: true },
      data:  { isDefault: false },
    })
  }

  const policy = await prisma.approvalPolicy.create({
    data: {
      organizationId:    session.organizationId,
      name:              name.trim(),
      description:       description?.trim() || null,
      isDefault:         Boolean(isDefault),
      escalateAfterHours: escalateAfterHours ? Number(escalateAfterHours) : 24,
      rules: rules?.length ? {
        create: (rules as RuleInput[]).map((r, i) => ({
          priority:          r.priority ?? (i + 1) * 10,
          minAmount:         r.minAmount != null ? Number(r.minAmount) : null,
          maxAmount:         r.maxAmount != null ? Number(r.maxAmount) : null,
          category:          r.category || null,
          departmentId:      r.departmentId || null,
          locationId:        r.locationId || null,
          vendorId:          r.vendorId || null,
          approvalPath:      r.approvalPath,
          escalateAfterHours: r.escalateAfterHours != null ? Number(r.escalateAfterHours) : null,
        })),
      } : undefined,
    },
    include: {
      rules: { orderBy: { priority: "asc" } },
      _count: { select: { catalogItems: true, purchaseRequests: true } },
    },
  })

  return NextResponse.json(policy, { status: 201 })
}

interface RuleInput {
  priority?: number
  minAmount?: number | null
  maxAmount?: number | null
  category?: string | null
  departmentId?: string | null
  locationId?: string | null
  vendorId?: string | null
  approvalPath: string
  escalateAfterHours?: number | null
}
