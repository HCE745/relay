// Manager: accounts by rep with activity status, duplicate flags, and protection badges.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

const INACTIVE_THRESHOLD_DAYS = 30
const OUTREACH_WARN_DAYS = 7

type ActivityStatus = "REGISTERED" | "ACTIVE" | "PROTECTED" | "INACTIVE"

function getActivityStatus(p: {
  createdAt: Date
  lastOutreachDate: Date | null
  lastReplyDate: Date | null
  demoCalls: { scheduledAt: Date | null; callStatus: string }[]
  opportunities: { stage: string }[]
}): ActivityStatus {
  const now = Date.now()
  const inactiveMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

  // Protected: active opportunity at Demo or later, or future scheduled DemoCall
  const protectedStages = ["Demo", "Proposal", "Negotiating", "Closed Won"]
  const hasActiveOpp = p.opportunities.some(o => protectedStages.includes(o.stage))
  const hasFutureDemo = p.demoCalls.some(
    d => d.callStatus === "Scheduled" && d.scheduledAt && new Date(d.scheduledAt) > new Date()
  )
  if (hasActiveOpp || hasFutureDemo) return "PROTECTED"

  const hasActivity = !!(p.lastOutreachDate ?? p.lastReplyDate)

  if (hasActivity) {
    const lastActivityDate = new Date(
      Math.max(
        p.lastOutreachDate?.getTime() ?? 0,
        p.lastReplyDate?.getTime() ?? 0
      )
    )
    if (now - lastActivityDate.getTime() > inactiveMs) return "INACTIVE"
    return "ACTIVE"
  }

  return "REGISTERED"
}

export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const repId = searchParams.get("repId")
  const flagged = searchParams.get("flagged") === "true"

  const where = {
    ...(repId ? { assignedToId: repId } : {}),
    ...(flagged ? { duplicateFlag: true } : {}),
  }

  const now = new Date()
  const warnCutoff = new Date(now.getTime() - OUTREACH_WARN_DAYS * 24 * 60 * 60 * 1000)

  const prospects = await prisma.prospect.findMany({
    where,
    select: {
      id: true, companyName: true, website: true, industry: true,
      currentCrmStatus: true, createdAt: true,
      lastOutreachDate: true, lastReplyDate: true,
      duplicateFlag: true, duplicateOfId: true,
      assignedToId: true, assignedToName: true,
      demoCalls: {
        orderBy: { scheduledAt: "desc" },
        take: 5,
        select: { callStatus: true, scheduledAt: true, createdAt: true },
      },
      opportunities: {
        select: { stage: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  const results = prospects.map(p => {
    const activityStatus = getActivityStatus({
      createdAt: p.createdAt,
      lastOutreachDate: p.lastOutreachDate,
      lastReplyDate: p.lastReplyDate,
      demoCalls: p.demoCalls,
      opportunities: p.opportunities,
    })

    const daysSinceOutreach = p.lastOutreachDate
      ? Math.floor((now.getTime() - new Date(p.lastOutreachDate).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const ageInDays = Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    const noOutreachWarning =
      activityStatus === "REGISTERED" &&
      ageInDays >= OUTREACH_WARN_DAYS &&
      !p.lastOutreachDate &&
      new Date(p.createdAt) < warnCutoff

    return {
      id: p.id,
      companyName: p.companyName,
      website: p.website,
      industry: p.industry,
      currentCrmStatus: p.currentCrmStatus,
      activityStatus,
      assignedToId: p.assignedToId,
      assignedToName: p.assignedToName,
      createdAt: p.createdAt,
      lastOutreachDate: p.lastOutreachDate,
      daysSinceOutreach,
      duplicateFlag: p.duplicateFlag,
      duplicateOfId: p.duplicateOfId,
      noOutreachWarning,
      isProtected: activityStatus === "PROTECTED",
    }
  })

  // Group by rep for the accounts-by-rep view
  const byRep: Record<string, { name: string | null; counts: Record<ActivityStatus, number> }> = {}
  for (const p of results) {
    const key = p.assignedToId ?? "unassigned"
    if (!byRep[key]) byRep[key] = { name: p.assignedToName, counts: { REGISTERED: 0, ACTIVE: 0, PROTECTED: 0, INACTIVE: 0 } }
    byRep[key].counts[p.activityStatus]++
  }

  return NextResponse.json({
    accounts: results,
    byRep,
    duplicateCount: results.filter(p => p.duplicateFlag).length,
    noOutreachCount: results.filter(p => p.noOutreachWarning).length,
  })
}
