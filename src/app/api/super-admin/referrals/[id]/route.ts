import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { triggerReferralReward } from "@/lib/billing-credits-engine"
import { logSAAction } from "@/lib/sa-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const referral = await prisma.referral.findUnique({
    where: { id },
    include: {
      referrerOrg: { select: { id: true, name: true } },
      referredOrg: { select: { id: true, name: true } },
    },
  })
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as { action?: "qualify" | "cancel"; rewardStatus?: string }

  if (body.action === "qualify") {
    // Manually trigger reward
    const result = await triggerReferralReward(id, session.superAdminId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    await logSAAction({
      superAdminId:   session.superAdminId,
      superAdminName: session.name,
      action:     "UPDATE_REFERRAL",
      orgId:      referral.referrerOrgId,
      orgName:    referral.referrerOrg.name,
      targetType: "organization",
      targetId:   id,
      targetName: `${referral.referrerOrg.name} → ${referral.referredOrg.name}`,
      before: { rewardStatus: referral.rewardStatus },
      after:  { rewardStatus: "rewarded", manual: true },
    })
  } else if (body.action === "cancel") {
    await prisma.referral.update({
      where: { id },
      data: { rewardStatus: "cancelled" },
    })
    await logSAAction({
      superAdminId:   session.superAdminId,
      superAdminName: session.name,
      action:     "UPDATE_REFERRAL",
      orgId:      referral.referrerOrgId,
      orgName:    referral.referrerOrg.name,
      targetType: "organization",
      targetId:   id,
      targetName: `${referral.referrerOrg.name} → ${referral.referredOrg.name}`,
      before: { rewardStatus: referral.rewardStatus },
      after:  { rewardStatus: "cancelled" },
    })
  }

  const fresh = await prisma.referral.findUnique({ where: { id } })
  return NextResponse.json(fresh)
}
