import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { PurchaseRequestsClient } from "./purchase-requests-client"
import { AISubmitFlow } from "./ai-submit-flow"

export const dynamic = "force-dynamic"

export default async function PurchaseRequestsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isAdminLevel = ["ADMIN", "MANAGER"].includes(session.role)

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      purchaseRequestEnabled:        true,
      purchaseRequestItemLimit:      true,
      purchaseRequestMonthlyLimit:   true,
      approval_intelligence_enabled: true,
    },
  })

  // ── Approval Intelligence flow ──────────────────────────────────────────────
  if (org?.approval_intelligence_enabled) {
    const [requests, assets] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where: {
          organizationId: session.organizationId,
          ...(isAdminLevel ? {} : { submittedById: session.userId }),
        },
        include: {
          submittedBy:     { select: { id: true, name: true } },
          approvedBy:      { select: { id: true, name: true } },
          asset:           { select: { id: true, name: true, type: true } },
          catalogItem:     { select: { id: true, name: true } },
          approvalHistory: {
            include: { approver: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.asset.findMany({
        where: { organizationId: session.organizationId, status: { not: "RETIRED" } },
        select: { id: true, name: true, type: true, qrCode: true },
        orderBy: { name: "asc" },
      }),
    ])

    return (
      <div>
        <Header title="Purchase Requests" />
        <div className="p-4 md:p-6 max-w-6xl" data-tour="purchase-intelligence">
          <AISubmitFlow
            initialRequests={requests.map(r => ({
              id:                r.id,
              itemName:          r.itemName,
              itemDescription:   r.itemDescription,
              estimatedCost:     r.estimatedCost,
              status:            r.status,
              referenceNumber:   r.referenceNumber,
              approvalPath:      r.approvalPath,
              aiItemIdentified:  r.aiItemIdentified,
              aiMatchConfidence: r.aiMatchConfidence,
              aiDamageAssessment: r.aiDamageAssessment,
              aiReasoning:       r.aiReasoning,
              rejectedReason:    r.rejectedReason,
              infoRequestMessage: r.infoRequestMessage,
              notes:             r.notes,
              createdAt:         r.createdAt.toISOString(),
              approvedAt:        r.approvedAt?.toISOString() ?? null,
              submittedBy:       r.submittedBy,
              approvedBy:        r.approvedBy,
              asset:             r.asset,
              catalogItem:       r.catalogItem,
              approvalHistory:   r.approvalHistory.map(h => ({
                id:        h.id,
                action:    h.action,
                notes:     h.notes,
                createdAt: h.createdAt.toISOString(),
                approver:  h.approver,
              })),
            }))}
            assets={assets}
            isAdminLevel={isAdminLevel}
            currentUserId={session.userId}
            userRole={session.role}
          />
        </div>
      </div>
    )
  }

  // ── Legacy flow ─────────────────────────────────────────────────────────────
  const [requests, assets] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: {
        organizationId: session.organizationId,
        ...(isAdminLevel ? {} : { submittedById: session.userId }),
      },
      include: {
        submittedBy: { select: { id: true, name: true } },
        approvedBy:  { select: { id: true, name: true } },
        asset:       { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { organizationId: session.organizationId, status: { not: "RETIRED" } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!org?.purchaseRequestEnabled && !isAdminLevel) {
    return (
      <div>
        <Header title="Purchase Requests" />
        <div className="p-6 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Purchase requests are not currently enabled for your organization.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Purchase Requests" />
      <div className="p-4 md:p-6 max-w-4xl" data-tour="purchase-intelligence">
        <PurchaseRequestsClient
          initialRequests={requests.map(r => ({
            id:              r.id,
            itemName:        r.itemName,
            itemDescription: r.itemDescription,
            estimatedCost:   r.estimatedCost,
            photoUrl:        r.photoUrl,
            aiVerified:      r.aiVerified,
            aiConfidence:    r.aiConfidence,
            aiAnalysis:      r.aiAnalysis,
            status:          r.status,
            rejectedReason:  r.rejectedReason,
            notes:           r.notes,
            createdAt:       r.createdAt.toISOString(),
            submittedBy:     r.submittedBy,
            approvedBy:      r.approvedBy,
            asset:           r.asset,
          }))}
          assets={assets}
          isAdminLevel={isAdminLevel}
          featureEnabled={org?.purchaseRequestEnabled ?? false}
          itemLimit={org?.purchaseRequestItemLimit ?? null}
          monthlyLimit={org?.purchaseRequestMonthlyLimit ?? null}
        />
      </div>
    </div>
  )
}
