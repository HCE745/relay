import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const ADMIN_ROLES = ["ADMIN", "MANAGER"]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const policy = await prisma.approvalPolicy.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      rules: { orderBy: { priority: "asc" } },
      _count: { select: { catalogItems: true, purchaseRequests: true } },
    },
  })

  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(policy)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.approvalPolicy.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()

  if (body.isDefault) {
    await prisma.approvalPolicy.updateMany({
      where: { organizationId: session.organizationId, isDefault: true, id: { not: id } },
      data:  { isDefault: false },
    })
  }

  // Replace rules if provided
  if (body.rules !== undefined) {
    await prisma.approvalPolicyRule.deleteMany({ where: { policyId: id } })
    if (body.rules.length > 0) {
      await prisma.approvalPolicyRule.createMany({
        data: (body.rules as RuleInput[]).map((r, i) => ({
          policyId:          id,
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
      })
    }
  }

  const updated = await prisma.approvalPolicy.update({
    where: { id },
    data: {
      ...(body.name !== undefined               ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined        ? { description: body.description?.trim() || null } : {}),
      ...(body.isDefault !== undefined          ? { isDefault: Boolean(body.isDefault) } : {}),
      ...(body.escalateAfterHours !== undefined ? { escalateAfterHours: Number(body.escalateAfterHours) } : {}),
    },
    include: {
      rules: { orderBy: { priority: "asc" } },
      _count: { select: { catalogItems: true, purchaseRequests: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.approvalPolicy.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.approvalPolicy.delete({ where: { id } })
  return NextResponse.json({ ok: true })
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
