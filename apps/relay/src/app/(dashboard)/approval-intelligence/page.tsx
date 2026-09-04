import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { ApprovalIntelligenceClient } from "./approval-intelligence-client"
import { isProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"

export const dynamic = "force-dynamic"

export default async function ApprovalIntelligencePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="Approval Intelligence" />
        <PlanGateContent feature="Approval Intelligence" />
      </div>
    )
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      approval_intelligence_enabled: true,
      ai_suggest_unmatched_items:    true,
      ai_confidence_threshold:       true,
    },
  })

  const [
    catalogCount,
    policyCount,
    pendingRequests,
    recentRequests,
  ] = await Promise.all([
    prisma.approvedCatalogItem.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.approvalPolicy.count({
      where: { organizationId: session.organizationId },
    }),
    prisma.purchaseRequest.count({
      where: { organizationId: session.organizationId, status: "AWAITING_APPROVAL" },
    }),
    prisma.purchaseRequest.findMany({
      where: {
        organizationId: session.organizationId,
        approvalPath: { not: null },
      },
      select: {
        id: true, status: true, createdAt: true, estimatedCost: true,
        aiMatchConfidence: true, approvalPath: true,
        submittedBy: { select: { name: true } },
        catalogItem:  { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  // Compute summary stats server-side for fast initial render
  const total       = recentRequests.length
  const autoApproved = recentRequests.filter(r => r.status === "AUTO_APPROVED" || r.status === "AI_APPROVED").length
  const approved     = recentRequests.filter(r => r.status === "APPROVED").length
  const rejected     = recentRequests.filter(r => r.status === "REJECTED").length
  const autoRate     = total > 0 ? Math.round((autoApproved / total) * 100) : 0

  // Category breakdown
  const catGroups: Record<string, { count: number; autoApproved: number; spend: number }> = {}
  for (const r of recentRequests) {
    const cat = r.catalogItem?.category ?? "GENERAL"
    if (!catGroups[cat]) catGroups[cat] = { count: 0, autoApproved: 0, spend: 0 }
    catGroups[cat].count++
    catGroups[cat].spend += r.estimatedCost ?? 0
    if (r.status === "AUTO_APPROVED" || r.status === "AI_APPROVED") catGroups[cat].autoApproved++
  }

  const avgConfidence = recentRequests.filter(r => r.aiMatchConfidence != null).length > 0
    ? Math.round(recentRequests.reduce((s, r) => s + (r.aiMatchConfidence ?? 0), 0) /
        recentRequests.filter(r => r.aiMatchConfidence != null).length * 100)
    : null

  return (
    <div>
      <Header title="Approval Intelligence" />
      <div className="p-4 md:p-6">
        <ApprovalIntelligenceClient
          orgEnabled={org?.approval_intelligence_enabled ?? false}
          orgId={session.organizationId}
          summary={{
            total, autoApproved, approved, rejected,
            pending: pendingRequests, autoRate,
            catalogCount, policyCount,
            avgConfidence,
            estimatedHoursSaved: Math.round(autoApproved * 0.5 * 10) / 10,
          }}
          byCategory={Object.entries(catGroups).map(([category, stats]) => ({ category, ...stats }))}
        />
      </div>
    </div>
  )
}
