import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const canViewAll = ["ADMIN", "MANAGER"].includes(session.role)

  const request = await prisma.purchaseRequest.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      ...(canViewAll ? {} : { submittedById: session.userId }),
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      approvedBy:  { select: { id: true, name: true } },
      asset:       { select: { id: true, name: true, type: true } },
    },
  })

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(request)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, rejectedReason, notes } = body

  const validStatuses = ["PENDING", "AI_APPROVED", "APPROVED", "REJECTED", "NEEDS_REVIEW"]
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const isApproving = status === "APPROVED" || status === "AI_APPROVED"
  const result = await prisma.purchaseRequest.updateMany({
    where: { id, organizationId: session.organizationId },
    data: {
      ...(status         !== undefined ? { status }         : {}),
      ...(rejectedReason !== undefined ? { rejectedReason } : {}),
      ...(notes          !== undefined ? { notes }          : {}),
      ...(isApproving    ? { approvedById: session.userId, approvedAt: new Date() } : {}),
    },
  })

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true } },
      approvedBy:  { select: { id: true, name: true } },
      asset:       { select: { id: true, name: true, type: true } },
    },
  })

  // Notify submitter of decision
  if (updated && (status === "APPROVED" || status === "REJECTED")) {
    await prisma.notification.create({
      data: {
        userId:         updated.submittedById,
        organizationId: session.organizationId,
        type:           "PURCHASE_REQUEST",
        title:          status === "APPROVED" ? "Purchase Request Approved" : "Purchase Request Rejected",
        message:        status === "APPROVED"
          ? `Your request for "${updated.itemName}" has been approved.`
          : `Your request for "${updated.itemName}" was not approved.${rejectedReason ? ` Reason: ${rejectedReason}` : ""}`,
      },
    })
  }

  return NextResponse.json(updated)
}
