import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { addDays } from "date-fns"

export const dynamic = "force-dynamic"

// Promotions dashboard: active credits, MRR impact, expiring soon, pending referrals
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const in30d = addDays(now, 30)

  const [activeCredits, expiringCredits, pendingReferrals, stats] = await Promise.all([
    prisma.billingCredit.findMany({
      where: { status: "active" },
      include: { org: { select: { id: true, name: true, monthlyTotalBeforeDiscount: true } } },
      orderBy: { effectiveDate: "desc" },
    }),
    prisma.billingCredit.findMany({
      where: {
        status: "active",
        durationUntilDate: { lte: in30d, gte: now },
      },
      include: { org: { select: { id: true, name: true } } },
      orderBy: { durationUntilDate: "asc" },
    }),
    prisma.referral.findMany({
      where: { rewardStatus: { in: ["pending", "qualifying"] } },
      include: {
        referrerOrg: { select: { id: true, name: true } },
        referredOrg: { select: { id: true, name: true, subscriptionStatus: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    Promise.all([
      prisma.billingCredit.count({ where: { status: "active" } }),
      prisma.billingCredit.count({ where: { status: "scheduled" } }),
      prisma.billingCredit.count({ where: { status: "pending" } }),
      prisma.referral.count({ where: { rewardStatus: { in: ["pending", "qualifying"] } } }),
    ]),
  ])

  const [activeCount, scheduledCount, pendingCount, pendingRefCount] = stats

  // Estimate MRR impact of active percentage_off and fixed_amount credits
  let mrrImpact = 0
  for (const c of activeCredits) {
    const base = c.org.monthlyTotalBeforeDiscount ?? 0
    if (c.creditType === "percentage_off") mrrImpact += base * (c.discountValue / 100)
    else if (c.creditType === "fixed_amount") mrrImpact += c.discountValue
    else if (["free_billing_cycles", "free_addon", "free_intelligence_module",
               "free_employee_band", "free_location"].includes(c.creditType)) mrrImpact += base
  }

  return NextResponse.json({
    activeCredits,
    expiringCredits,
    pendingReferrals,
    summary: {
      activeCredits:    activeCount,
      scheduledCredits: scheduledCount,
      pendingCredits:   pendingCount,
      pendingReferrals: pendingRefCount,
      mrrImpact:        Math.round(mrrImpact * 100) / 100,
    },
  })
}
