import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { triggerReferralReward, cancelCredit, createCredit } from "@/lib/billing-credits-engine"
import { logSAAction } from "@/lib/sa-audit"
import type { CreditType, CreditAppliesTo, CreditSchedulingType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

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
      referrerOrg:   { select: { id: true, name: true } },
      referredOrg:   { select: { id: true, name: true } },
      referrerCredit: { select: { id: true, status: true } },
      referredCredit: { select: { id: true, status: true } },
    },
  })
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as {
    action?: "qualify" | "cancel" | "disqualify" | "pause" | "resume" | "flag_fraud" | "unflag_fraud" | "add_note" | "override_reward"
    reason?: string
    note?: string
    qualificationDate?: string
    overrideReferrerReward?: {
      creditType: string; appliesTo: string; discountValue: number
      durationCycles: number; schedulingType: string; description: string
    }
    overrideReferredReward?: {
      creditType: string; appliesTo: string; discountValue: number
      durationCycles: number; schedulingType: string; description: string
    }
  }

  const auditBase = {
    superAdminId: session.superAdminId, superAdminName: session.name,
    action: "UPDATE_REFERRAL" as const,
    orgId: referral.referrerOrgId, orgName: referral.referrerOrg.name,
    targetType: "organization" as const,
    targetId: id,
    targetName: `${referral.referrerOrg.name} → ${referral.referredOrg.name}`,
  }

  if (body.action === "qualify") {
    const result = await triggerReferralReward(id, session.superAdminId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await logSAAction({ ...auditBase, before: { rewardStatus: referral.rewardStatus }, after: { rewardStatus: "rewarded", manual: true } })

  } else if (body.action === "cancel") {
    // Cancel any linked credits
    if (referral.referrerCredit?.id) await cancelCredit(referral.referrerCredit.id, "Referral cancelled by Super Admin")
    if (referral.referredCredit?.id)  await cancelCredit(referral.referredCredit.id,  "Referral cancelled by Super Admin")
    await prisma.referral.update({ where: { id }, data: { rewardStatus: "cancelled" } })
    await logSAAction({ ...auditBase, before: { rewardStatus: referral.rewardStatus }, after: { rewardStatus: "cancelled" } })

  } else if (body.action === "disqualify") {
    if (referral.referrerCredit?.id) await cancelCredit(referral.referrerCredit.id, "Referral disqualified")
    if (referral.referredCredit?.id)  await cancelCredit(referral.referredCredit.id,  "Referral disqualified")
    await prisma.referral.update({
      where: { id },
      data: { rewardStatus: "disqualified", disqualifiedAt: new Date(), disqualifiedReason: body.reason ?? "Disqualified by Super Admin" },
    })
    await logSAAction({ ...auditBase, before: { rewardStatus: referral.rewardStatus }, after: { rewardStatus: "disqualified", reason: body.reason } })

  } else if (body.action === "pause") {
    await prisma.referral.update({ where: { id }, data: { rewardStatus: "paused", pausedAt: new Date() } })
    await logSAAction({ ...auditBase, before: { rewardStatus: referral.rewardStatus }, after: { rewardStatus: "paused" } })

  } else if (body.action === "resume") {
    const prevStatus = referral.consecutiveMonthsPaid > 0 ? "qualifying" : "pending"
    await prisma.referral.update({ where: { id }, data: { rewardStatus: prevStatus as never, pausedAt: null } })
    await logSAAction({ ...auditBase, before: { rewardStatus: "paused" }, after: { rewardStatus: prevStatus } })

  } else if (body.action === "flag_fraud") {
    await prisma.referral.update({ where: { id }, data: { fraudReview: true, fraudNotes: body.note ?? null } })
    await logSAAction({ ...auditBase, after: { fraudReview: true, fraudNotes: body.note } })

  } else if (body.action === "unflag_fraud") {
    await prisma.referral.update({ where: { id }, data: { fraudReview: false, fraudNotes: null } })
    await logSAAction({ ...auditBase, after: { fraudReview: false } })

  } else if (body.action === "add_note") {
    await prisma.referral.update({ where: { id }, data: { internalNotes: body.note ?? null } })
    await logSAAction({ ...auditBase, after: { note: body.note } })

  } else if (body.action === "override_reward") {
    // Cancel existing credits if any
    if (referral.referrerCredit?.id) await cancelCredit(referral.referrerCredit.id, "Overridden by Super Admin")
    if (referral.referredCredit?.id)  await cancelCredit(referral.referredCredit.id,  "Overridden by Super Admin")

    const r = body.overrideReferrerReward
    const d = body.overrideReferredReward

    const referrerCredit = r ? await createCredit(
      referral.referrerOrgId,
      {
        creditType:     r.creditType as CreditType,
        appliesTo:      r.appliesTo  as CreditAppliesTo,
        discountValue:  r.discountValue,
        durationCycles: r.durationCycles,
        durationType:   "one_invoice",
        schedulingType: r.schedulingType as CreditSchedulingType,
        description:    r.description,
        reason:         "Referral reward override by Super Admin",
      },
      session.superAdminId,
    ) : null

    const referredCredit = d ? await createCredit(
      referral.referredOrgId,
      {
        creditType:     d.creditType as CreditType,
        appliesTo:      d.appliesTo  as CreditAppliesTo,
        discountValue:  d.discountValue,
        durationCycles: d.durationCycles,
        durationType:   "one_invoice",
        schedulingType: d.schedulingType as CreditSchedulingType,
        description:    d.description,
        reason:         "Referral reward override (referred) by Super Admin",
      },
      session.superAdminId,
    ) : null

    await prisma.referral.update({
      where: { id },
      data: {
        rewardStatus:     "rewarded",
        rewardDate:       new Date(),
        qualifiedAt:      referral.qualifiedAt ?? new Date(),
        referrerCreditId: referrerCredit?.id ?? referral.referrerCreditId,
        referredCreditId: referredCredit?.id ?? referral.referredCreditId,
      },
    })
    await logSAAction({ ...auditBase, after: { overrideReward: true, manual: true } })
  }

  const fresh = await prisma.referral.findUnique({
    where: { id },
    include: {
      referrerOrg:   { select: { id: true, name: true, referralCode: true } },
      referredOrg:   { select: { id: true, name: true, subscriptionStatus: true } },
      referrerCredit: { select: { id: true, status: true, description: true } },
      referredCredit: { select: { id: true, status: true, description: true } },
    },
  })
  return NextResponse.json(fresh)
}
