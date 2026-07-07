import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const ADMIN_ROLES = ["ADMIN", "MANAGER"]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const item = await prisma.approvedCatalogItem.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      preferredVendor: { select: { id: true, name: true } },
      approvalPolicy:  { select: { id: true, name: true } },
      substitutes:     { include: { substituteItem: { select: { id: true, name: true, category: true } } } },
      purchaseRequests: {
        select: { id: true, createdAt: true, status: true, estimatedCost: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { purchaseRequests: true } },
    },
  })

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
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
  const existing = await prisma.approvedCatalogItem.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.approvedCatalogItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined        ? { name: body.name.trim() } : {}),
      ...(body.category !== undefined    ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.preferredVendorId !== undefined ? { preferredVendorId: body.preferredVendorId || null } : {}),
      ...(body.vendorSku !== undefined   ? { vendorSku: body.vendorSku?.trim() || null } : {}),
      ...(body.manufacturer !== undefined ? { manufacturer: body.manufacturer?.trim() || null } : {}),
      ...(body.modelNumber !== undefined  ? { modelNumber: body.modelNumber?.trim() || null } : {}),
      ...(body.estimatedCost !== undefined ? { estimatedCost: body.estimatedCost != null ? Number(body.estimatedCost) : null } : {}),
      ...(body.replacementUrl !== undefined ? { replacementUrl: body.replacementUrl?.trim() || null } : {}),
      ...(body.approvalPolicyId !== undefined ? { approvalPolicyId: body.approvalPolicyId || null } : {}),
      ...(body.autoApproveBelow !== undefined ? { autoApproveBelow: body.autoApproveBelow != null ? Number(body.autoApproveBelow) : null } : {}),
      ...(body.notes !== undefined        ? { notes: body.notes?.trim() || null } : {}),
      ...(body.isActive !== undefined     ? { isActive: Boolean(body.isActive) } : {}),
    },
    include: {
      preferredVendor: { select: { id: true, name: true } },
      approvalPolicy:  { select: { id: true, name: true } },
      _count: { select: { purchaseRequests: true } },
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
  const existing = await prisma.approvedCatalogItem.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Soft-delete if it has purchase requests, hard-delete if not
  const count = await prisma.purchaseRequest.count({ where: { catalogItemId: id } })
  if (count > 0) {
    await prisma.approvedCatalogItem.update({ where: { id }, data: { isActive: false } })
  } else {
    await prisma.approvedCatalogItem.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
