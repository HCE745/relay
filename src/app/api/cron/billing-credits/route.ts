import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAndActivateScheduledCredits, triggerReferralReward } from "@/lib/billing-credits-engine"
import { sendEmail, referralRewardReferrerEmail, referralRewardReferredEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

// Daily cron at 6am UTC. Set CRON_SECRET and call with Authorization: Bearer <secret>.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const now    = new Date()

  // ── 1. Run scheduled credit activation + completion checks ──────────────────
  const creditResult = await checkAndActivateScheduledCredits()

  // ── 2. Update referral consecutive months paid ───────────────────────────────
  const activeReferrals = await prisma.referral.findMany({
    where: { rewardStatus: { in: ["pending", "qualifying"] } },
    include: {
      referredOrg: {
        select: {
          id: true, name: true, subscriptionStatus: true, createdAt: true,
          users: { where: { role: "admin" }, take: 1, select: { name: true, email: true } },
        },
      },
      referrerOrg: {
        select: {
          id: true, name: true,
          users: { where: { role: "admin" }, take: 1, select: { name: true, email: true } },
        },
      },
    },
  })

  const systemSA = await prisma.superAdmin.findFirst({ select: { id: true } })
  const referralResults: { id: string; action: string; error?: string }[] = []

  for (const ref of activeReferrals) {
    const referred = ref.referredOrg
    const isPayingMonthly =
      referred.subscriptionStatus === "active" || referred.subscriptionStatus === "past_due"

    // Track first payment date
    if (!ref.firstPaymentDate && isPayingMonthly) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: { firstPaymentDate: now, rewardStatus: "qualifying" },
      })
    }

    // Count consecutive months paid (naive: months since firstPaymentDate)
    if (ref.firstPaymentDate && isPayingMonthly) {
      const monthsPaid = Math.floor(
        (now.getTime() - ref.firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      ) + 1

      await prisma.referral.update({
        where: { id: ref.id },
        data: { consecutiveMonthsPaid: monthsPaid },
      })

      // Check if qualified
      if (monthsPaid >= ref.qualificationMonthsRequired && ref.rewardStatus !== "rewarded") {
        if (!systemSA) { referralResults.push({ id: ref.id, action: "skipped_no_sa" }); continue }

        try {
          const result = await triggerReferralReward(ref.id, systemSA.id)
          if (!result.ok) {
            referralResults.push({ id: ref.id, action: "reward_failed", error: result.error })
            continue
          }

          // Send notification emails
          const referrerAdmin = ref.referrerOrg.users[0]
          const referredAdmin = referred.users[0]
          const rewardDesc    = "1 free billing cycle"

          if (referrerAdmin?.email) {
            const payload = referralRewardReferrerEmail({
              referrerAdminName: referrerAdmin.name ?? ref.referrerOrg.name,
              referrerOrgName:   ref.referrerOrg.name,
              referredOrgName:   referred.name,
              rewardDescription: rewardDesc,
              dashboardUrl:      `${appUrl}/dashboard`,
            })
            sendEmail({ ...payload, to: referrerAdmin.email }).catch(console.error)
          }

          if (referredAdmin?.email) {
            const payload = referralRewardReferredEmail({
              referredAdminName: referredAdmin.name ?? referred.name,
              referredOrgName:   referred.name,
              referrerOrgName:   ref.referrerOrg.name,
              rewardDescription: rewardDesc,
              dashboardUrl:      `${appUrl}/dashboard`,
            })
            sendEmail({ ...payload, to: referredAdmin.email }).catch(console.error)
          }

          referralResults.push({ id: ref.id, action: "rewarded" })
        } catch (err) {
          referralResults.push({ id: ref.id, action: "error", error: err instanceof Error ? err.message : String(err) })
        }
      }
    }
  }

  // ── 3. Send 7-day expiry warning emails ──────────────────────────────────────
  // (Placeholder — can be wired to a proper email template when one is created)
  const expiringSoon = await prisma.billingCredit.findMany({
    where: {
      status: "active",
      durationUntilDate: {
        gte: now,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: { org: { select: { name: true } } },
  })

  return NextResponse.json({
    credits:         creditResult,
    referrals:       referralResults,
    expiringSoonIds: expiringSoon.map(c => c.id),
  })
}
