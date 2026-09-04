import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = session.organizationId

  const [
    requests,
    approvalActions,
    catalogItems,
  ] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: { organizationId: orgId, approvalPath: { not: null } },
      include: {
        submittedBy: { select: { name: true, department: { select: { name: true } } } },
        catalogItem:  { select: { name: true, category: true } },
        approvalHistory: {
          select: { action: true, createdAt: true, approverId: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseRequestApproval.findMany({
      where: { purchaseRequest: { organizationId: orgId } },
      select: { action: true, approverId: true, createdAt: true, purchaseRequestId: true },
    }),
    prisma.approvedCatalogItem.count({ where: { organizationId: orgId, isActive: true } }),
  ])

  // Summary stats
  const total = requests.length
  const autoApproved = requests.filter(r => r.status === "AUTO_APPROVED" || r.status === "AI_APPROVED").length
  const manualApproved = requests.filter(r => r.status === "APPROVED").length
  const rejected = requests.filter(r => r.status === "REJECTED").length
  const pending = requests.filter(r => ["AWAITING_APPROVAL", "PENDING", "INFO_REQUESTED", "NEEDS_REVIEW"].includes(r.status)).length

  const autoApprovalRate = total > 0 ? Math.round((autoApproved / total) * 100) : 0

  // Average approval time (for approved requests)
  const approvedRequests = requests.filter(r => r.approvedAt && r.createdAt)
  const avgApprovalHours = approvedRequests.length > 0
    ? Math.round(
        approvedRequests.reduce((sum, r) => {
          const ms = r.approvedAt!.getTime() - r.createdAt.getTime()
          return sum + ms / 3600000
        }, 0) / approvedRequests.length
      )
    : null

  const estimatedHoursSaved = autoApproved * 0.5 // 30 min per manual review avoided

  // Trend by month (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const monthlyGroups: Record<string, { total: number; autoApproved: number; spend: number }> = {}
  for (const r of requests) {
    if (r.createdAt < sixMonthsAgo) continue
    const key = r.createdAt.toISOString().slice(0, 7)
    if (!monthlyGroups[key]) monthlyGroups[key] = { total: 0, autoApproved: 0, spend: 0 }
    monthlyGroups[key].total++
    if (r.status === "AUTO_APPROVED" || r.status === "AI_APPROVED") monthlyGroups[key].autoApproved++
    monthlyGroups[key].spend += r.estimatedCost ?? 0
  }

  const trendData = Object.entries(monthlyGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => ({ month, ...stats }))

  // By department
  const deptGroups: Record<string, { name: string; count: number; spend: number }> = {}
  for (const r of requests) {
    const dept = r.submittedBy.department?.name ?? "Unassigned"
    if (!deptGroups[dept]) deptGroups[dept] = { name: dept, count: 0, spend: 0 }
    deptGroups[dept].count++
    deptGroups[dept].spend += r.estimatedCost ?? 0
  }

  // By category
  const catGroups: Record<string, { count: number; spend: number; autoApproved: number }> = {}
  for (const r of requests) {
    const cat = r.catalogItem?.category ?? "GENERAL"
    if (!catGroups[cat]) catGroups[cat] = { count: 0, spend: 0, autoApproved: 0 }
    catGroups[cat].count++
    catGroups[cat].spend += r.estimatedCost ?? 0
    if (r.status === "AUTO_APPROVED" || r.status === "AI_APPROVED") catGroups[cat].autoApproved++
  }

  // AI accuracy (human agreed with AI match)
  const humanReviewed = requests.filter(r => r.approvalHistory.some(a => a.action === "APPROVED" || a.action === "REJECTED"))
  const humanApprovedWithHighConfidence = humanReviewed.filter(r => (r.aiMatchConfidence ?? 0) >= 0.8 && r.status === "APPROVED")
  const aiAccuracy = humanReviewed.length > 0
    ? Math.round((humanApprovedWithHighConfidence.length / humanReviewed.length) * 100)
    : null

  const avgConfidence = requests.filter(r => r.aiMatchConfidence != null).length > 0
    ? Math.round(
        requests.reduce((s, r) => s + (r.aiMatchConfidence ?? 0), 0) /
        requests.filter(r => r.aiMatchConfidence != null).length * 100
      )
    : null

  return NextResponse.json({
    summary: {
      total,
      autoApproved,
      manualApproved,
      rejected,
      pending,
      autoApprovalRate,
      avgApprovalHours,
      estimatedHoursSaved: Math.round(estimatedHoursSaved * 10) / 10,
      catalogItemCount: catalogItems,
    },
    trendData,
    byDepartment: Object.values(deptGroups).sort((a, b) => b.spend - a.spend),
    byCategory: Object.entries(catGroups)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.count - a.count),
    aiPerformance: {
      accuracy: aiAccuracy,
      avgConfidence,
      autoApprovedCount: autoApproved,
      humanOverrides: approvalActions.filter(a => a.action === "ITEM_CHANGED").length,
    },
  })
}
