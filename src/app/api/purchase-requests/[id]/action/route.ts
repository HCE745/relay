import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const APPROVER_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      submittedBy:  { select: { id: true, name: true } },
      catalogItem:  { select: { id: true, name: true } },
    },
  })
  if (!pr) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { action, notes, overrideItemId } = await req.json() as {
    action: string
    notes?: string
    overrideItemId?: string
  }

  const validActions = ["APPROVED", "REJECTED", "INFO_REQUESTED", "ITEM_CHANGED"]
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  if (action === "REJECTED" && !notes?.trim()) {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
  }
  if (action === "INFO_REQUESTED" && !notes?.trim()) {
    return NextResponse.json({ error: "Information request message is required" }, { status: 400 })
  }

  // Validate override item if provided
  let overrideItem: { id: string; name: string; estimatedCost: number | null; vendorSku: string | null; replacementUrl: string | null } | null = null
  if (overrideItemId) {
    overrideItem = await prisma.approvedCatalogItem.findFirst({
      where: { id: overrideItemId, organizationId: session.organizationId },
      select: { id: true, name: true, estimatedCost: true, vendorSku: true, replacementUrl: true },
    })
    if (!overrideItem) return NextResponse.json({ error: "Override item not found" }, { status: 404 })
  }

  // Record the approval action
  await prisma.purchaseRequestApproval.create({
    data: {
      purchaseRequestId: id,
      approverId:        session.userId,
      action,
      notes:             notes?.trim() || null,
      overrideItemId:    overrideItem?.id ?? null,
    },
  })

  // Update the purchase request status
  const newStatus =
    action === "APPROVED"        ? "APPROVED" :
    action === "REJECTED"        ? "REJECTED" :
    action === "INFO_REQUESTED"  ? "INFO_REQUESTED" :
    action === "ITEM_CHANGED"    ? "AWAITING_APPROVAL" :  // re-enter approval with new item
    pr.status

  const updateData: Record<string, unknown> = { status: newStatus }

  if (action === "APPROVED") {
    updateData.approvedById = session.userId
    updateData.approvedAt   = new Date()
  }
  if (action === "REJECTED") {
    updateData.rejectedReason = notes?.trim()
  }
  if (action === "INFO_REQUESTED") {
    updateData.infoRequestMessage = notes?.trim()
  }
  if (action === "ITEM_CHANGED" && overrideItem) {
    updateData.catalogItemId   = overrideItem.id
    updateData.estimatedCost   = overrideItem.estimatedCost
    updateData.vendorSku       = overrideItem.vendorSku
    updateData.replacementUrl  = overrideItem.replacementUrl
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data:  updateData,
    include: {
      submittedBy:    { select: { id: true, name: true } },
      approvedBy:     { select: { id: true, name: true } },
      catalogItem:    { select: { id: true, name: true } },
      approvalHistory: {
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  // Notify the submitter
  const notifTitle =
    action === "APPROVED"       ? "Purchase Request Approved" :
    action === "REJECTED"       ? "Purchase Request Rejected" :
    action === "INFO_REQUESTED" ? "More Information Needed" :
    "Purchase Request Updated"

  const notifMessage =
    action === "APPROVED"
      ? `Your request for "${pr.itemName}" has been approved by ${session.name}.`
      : action === "REJECTED"
      ? `Your request for "${pr.itemName}" was rejected: ${notes?.trim()}`
      : action === "INFO_REQUESTED"
      ? `${session.name} needs more information about your request for "${pr.itemName}": ${notes?.trim()}`
      : `Your purchase request for "${pr.itemName}" has been updated.`

  await prisma.notification.create({
    data: {
      userId:         pr.submittedById,
      organizationId: session.organizationId,
      type:           "PURCHASE_REQUEST",
      title:          notifTitle,
      message:        notifMessage,
    },
  })

  return NextResponse.json(updated)
}
