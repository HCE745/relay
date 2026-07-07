import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const ADMIN_ROLES = ["ADMIN", "MANAGER"]

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const category = searchParams.get("category") || undefined
  const active = searchParams.get("active")

  const items = await prisma.approvedCatalogItem.findMany({
    where: {
      organizationId: session.organizationId,
      ...(category ? { category } : {}),
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
    },
    include: {
      preferredVendor: { select: { id: true, name: true } },
      approvalPolicy:  { select: { id: true, name: true } },
      _count: { select: { purchaseRequests: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    name, category, description, preferredVendorId, vendorSku,
    manufacturer, modelNumber, estimatedCost, replacementUrl,
    approvalPolicyId, autoApproveBelow, notes,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const item = await prisma.approvedCatalogItem.create({
    data: {
      organizationId:   session.organizationId,
      name:             name.trim(),
      category:         category || "GENERAL",
      description:      description?.trim() || null,
      preferredVendorId: preferredVendorId || null,
      vendorSku:        vendorSku?.trim() || null,
      manufacturer:     manufacturer?.trim() || null,
      modelNumber:      modelNumber?.trim() || null,
      estimatedCost:    estimatedCost ? Number(estimatedCost) : null,
      replacementUrl:   replacementUrl?.trim() || null,
      approvalPolicyId: approvalPolicyId || null,
      autoApproveBelow: autoApproveBelow ? Number(autoApproveBelow) : null,
      notes:            notes?.trim() || null,
    },
    include: {
      preferredVendor: { select: { id: true, name: true } },
      approvalPolicy:  { select: { id: true, name: true } },
      _count: { select: { purchaseRequests: true } },
    },
  })

  return NextResponse.json(item, { status: 201 })
}
