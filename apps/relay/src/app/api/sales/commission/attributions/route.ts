// POST: create a new commission attribution (split) for an opportunity.
// Only managers/superAdmins can do this. All splits for an opportunity must sum to 100%.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { validateCommissionSplits } from "@/lib/prospect-utils"
import { ATTRIBUTION_LOCK_HOURS } from "@/lib/commission"

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    opportunityId: string
    commissionOwnerId: string
    splitPercent: number
    commissionStartDate?: string | null
    commissionEndDate?: string | null
    attributionReason?: string
    notes?: string
  }

  if (!body.opportunityId || !body.commissionOwnerId) {
    return NextResponse.json({ error: "opportunityId and commissionOwnerId are required" }, { status: 400 })
  }

  const opp = await prisma.crmOpportunity.findUnique({ where: { id: body.opportunityId } })
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })

  const rep = await prisma.salesUser.findUnique({
    where: { id: body.commissionOwnerId },
    select: { commissionRate: true, commissionEligible: true },
  })
  if (!rep) return NextResponse.json({ error: "Sales user not found" }, { status: 404 })

  // Validate that new split + existing splits = 100
  const existing = await prisma.commissionAttribution.findMany({
    where: { opportunityId: body.opportunityId },
    select: { splitPercent: true },
  })
  const splitError = validateCommissionSplits([
    { splitPercent: body.splitPercent },
    ...existing,
  ])
  if (splitError) return NextResponse.json({ error: splitError }, { status: 400 })

  const lockedAt = new Date(Date.now() + ATTRIBUTION_LOCK_HOURS * 60 * 60 * 1000)

  const attribution = await prisma.commissionAttribution.create({
    data: {
      opportunityId: body.opportunityId,
      commissionOwnerId: body.commissionOwnerId,
      commissionRate: rep.commissionRate,
      splitPercent: body.splitPercent,
      commissionStartDate: body.commissionStartDate ? new Date(body.commissionStartDate) : null,
      commissionEndDate: body.commissionEndDate ? new Date(body.commissionEndDate) : null,
      attributionStatus: "PENDING",
      attributionReason: (body.attributionReason as never) ?? "NORMAL_CLOSE",
      attributionLockedAt: lockedAt,
      notes: body.notes ?? null,
    },
  })

  return NextResponse.json(attribution, { status: 201 })
}
