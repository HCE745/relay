import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const referrals = await prisma.referral.findMany({
    where: status ? { rewardStatus: status as never } : undefined,
    include: {
      referrerOrg: { select: { id: true, name: true, referralCode: true } },
      referredOrg: { select: { id: true, name: true, subscriptionStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const [total, qualifying, rewarded] = await Promise.all([
    prisma.referral.count(),
    prisma.referral.count({ where: { rewardStatus: "qualifying" } }),
    prisma.referral.count({ where: { rewardStatus: "rewarded" } }),
  ])

  return NextResponse.json({
    referrals,
    stats: { total, qualifying, rewarded, conversionRate: total > 0 ? (rewarded / total * 100).toFixed(1) : "0.0" },
  })
}
