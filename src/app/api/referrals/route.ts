import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getActiveReferralProgram } from "@/lib/billing-credits-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = session.organizationId

  const [org, program, referralsMade, creditStats] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { referralCode: true, referralLink: true, name: true },
    }),
    getActiveReferralProgram(),
    prisma.referral.findMany({
      where: { referrerOrgId: orgId },
      include: {
        referredOrg: {
          select: { id: true, name: true, subscriptionStatus: true, plan: true, createdAt: true },
        },
        referrerCredit: { select: { id: true, status: true, description: true, effectiveDate: true } },
        referredByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Sum credits earned by this org from referrals
    prisma.billingCredit.aggregate({
      where: {
        orgId,
        reason: { contains: "Referral" },
        status: { in: ["active", "completed"] },
      },
      _sum: { discountValue: true },
    }),
  ])

  // Compute display status (customer-visible, privacy-safe)
  const referrals = referralsMade.map(r => {
    const monthsRequired = r.qualificationMonthsRequired
    const monthsPaid = r.consecutiveMonthsPaid

    let displayStatus: string
    if (r.rewardStatus === "disqualified") {
      displayStatus = "Disqualified"
    } else if (r.rewardStatus === "cancelled") {
      displayStatus = "Cancelled"
    } else if (r.rewardStatus === "rewarded") {
      const creditStatus = r.referrerCredit?.status
      displayStatus = creditStatus === "completed" ? "Reward Applied"
        : creditStatus === "active" ? "Reward Applied"
        : "Rewards Scheduled"
    } else if (r.rewardStatus === "qualified") {
      displayStatus = "Qualified"
    } else if (r.rewardStatus === "paused") {
      displayStatus = "Qualification Paused"
    } else if (r.rewardStatus === "qualifying" && monthsPaid > 0) {
      displayStatus = `Qualification In Progress`
    } else if (r.firstPaymentDate) {
      displayStatus = "Paid"
    } else if (r.referredOrg.subscriptionStatus === "trialing") {
      displayStatus = "Trial Active"
    } else if (r.referredOrg.subscriptionStatus === "active") {
      displayStatus = "Paid"
    } else {
      displayStatus = "Signup Started"
    }

    // Privacy: only show org name once they have created an account (they always have, since referredOrg exists)
    // But don't expose plan/billing details of the referred org
    const orgName = r.referredOrg.name

    return {
      id:                       r.id,
      orgName,
      signupDate:               r.signupDate,
      firstPaymentDate:         r.firstPaymentDate,
      consecutiveMonthsPaid:    monthsPaid,
      qualificationMonthsRequired: monthsRequired,
      rewardStatus:             r.rewardStatus,
      displayStatus,
      qualifiedAt:              r.qualifiedAt,
      rewardDate:               r.rewardDate,
      source:                   r.source,
      referredByUser:           r.referredByUser,
      referrerCreditStatus:     r.referrerCredit?.status ?? null,
      referrerCreditDescription: r.referrerCredit?.description ?? null,
      referrerCreditEffectiveDate: r.referrerCredit?.effectiveDate ?? null,
      fraudReview:              r.fraudReview,
    }
  })

  const stats = {
    submitted:    referrals.length,
    qualified:    referrals.filter(r => ["rewarded", "qualified"].includes(r.rewardStatus)).length,
    pending:      referrals.filter(r => ["pending", "qualifying", "paused"].includes(r.rewardStatus)).length,
    creditsEarned: creditStats._sum.discountValue ?? 0,
  }

  return NextResponse.json({
    org: {
      referralCode: org?.referralCode ?? null,
      referralLink: org?.referralLink ?? null,
    },
    program: program ? {
      cardTitle:               program.cardTitle,
      cardDescription:         program.cardDescription,
      programDescription:      program.programDescription,
      termsText:               program.termsText,
      ctaLabel:                program.ctaLabel,
      consecutiveMonthsRequired: program.consecutiveMonthsRequired,
      qualificationExplanation:  program.qualificationExplanation,
      successMessage:          program.successMessage,
      pendingRewardMessage:    program.pendingRewardMessage,
      showOnDashboard:         program.showOnDashboard,
      visibleToRoles:          program.visibleToRoles,
      referrerRewardType:      program.referrerRewardType,
      referrerRewardValue:     program.referrerRewardValue,
      referrerRewardCycles:    program.referrerRewardCycles,
    } : null,
    referrals,
    stats,
  })
}
