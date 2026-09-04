import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  checkAndActivateScheduledCredits,
  triggerReferralReward,
  getActiveReferralProgram,
} from "@/lib/billing-credits-engine"
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

  // ── 2. Load config + active referrals ───────────────────────────────────────
  const [activeProgram, systemSA] = await Promise.all([
    getActiveReferralProgram(),
    prisma.superAdmin.findFirst({ select: { id: true } }),
  ])

  const activeReferrals = await prisma.referral.findMany({
    where: { rewardStatus: { in: ["pending", "qualifying", "paused"] } },
    include: {
      referredOrg: {
        select: {
          id: true, name: true, subscriptionStatus: true, plan: true, createdAt: true,
          users: { where: { role: "ADMIN" }, take: 1, select: { name: true, email: true } },
        },
      },
      referrerOrg: {
        select: {
          id: true, name: true,
          users: { where: { role: "ADMIN" }, take: 1, select: { name: true, email: true } },
        },
      },
    },
  })

  const referralResults: { id: string; action: string; error?: string }[] = []

  for (const ref of activeReferrals) {
    const referred  = ref.referredOrg
    const cfg       = activeProgram // use active program config (may differ from referral's program)
    const monthsReq = ref.qualificationMonthsRequired // locked at signup time

    // Resolve subscription state
    const isPaid    = referred.subscriptionStatus === "active"
    const isPastDue = referred.subscriptionStatus === "past_due"
    const isCancelled = ["cancelled", "expired", "trialing"].includes(referred.subscriptionStatus ?? "")

    // ── Fraud gate: don't process if flagged for review ──────────────────────
    if (ref.fraudReview) {
      referralResults.push({ id: ref.id, action: "skipped_fraud_review" })
      continue
    }

    // ── Program date gate ────────────────────────────────────────────────────
    if (cfg?.programEndDate && cfg.programEndDate < now) {
      referralResults.push({ id: ref.id, action: "skipped_program_ended" })
      continue
    }

    // ── Handle paused referrals ──────────────────────────────────────────────
    if (ref.rewardStatus === "paused") {
      // Resume automatically if org is now paying and program says pause during failed payment
      if (isPaid && cfg?.pauseOnFailedPayment) {
        const prevStatus = ref.consecutiveMonthsPaid > 0 ? "qualifying" : "pending"
        await prisma.referral.update({ where: { id: ref.id }, data: { rewardStatus: prevStatus as never, pausedAt: null } })
        referralResults.push({ id: ref.id, action: "resumed" })
      } else {
        referralResults.push({ id: ref.id, action: "still_paused" })
      }
      continue
    }

    // ── Cancellation: reset clock if config says so ──────────────────────────
    if (isCancelled && ref.firstPaymentDate) {
      if (cfg?.resetClockOnCancellation) {
        await prisma.referral.update({
          where: { id: ref.id },
          data: { consecutiveMonthsPaid: 0, firstPaymentDate: null, rewardStatus: "pending" },
        })
        referralResults.push({ id: ref.id, action: "clock_reset_on_cancellation" })
      } else {
        // Disqualify if not resetting
        await prisma.referral.update({
          where: { id: ref.id },
          data: { rewardStatus: "disqualified", disqualifiedAt: now, disqualifiedReason: "Subscription cancelled before qualification" },
        })
        referralResults.push({ id: ref.id, action: "disqualified_cancelled" })
      }
      continue
    }

    // ── Past due: pause if config says so ───────────────────────────────────
    if (isPastDue && cfg?.pauseOnFailedPayment) {
      await prisma.referral.update({ where: { id: ref.id }, data: { rewardStatus: "paused", pausedAt: now } })
      referralResults.push({ id: ref.id, action: "paused_past_due" })
      continue
    }

    // ── Track first payment ──────────────────────────────────────────────────
    if (!ref.firstPaymentDate && isPaid) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: { firstPaymentDate: now, rewardStatus: "qualifying" },
      })
    }

    // ── Count consecutive months paid ────────────────────────────────────────
    if (ref.firstPaymentDate && isPaid) {
      const monthsPaid = Math.floor(
        (now.getTime() - ref.firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      ) + 1

      await prisma.referral.update({ where: { id: ref.id }, data: { consecutiveMonthsPaid: monthsPaid } })

      // ── Check reward limits ──────────────────────────────────────────────
      if (monthsPaid >= monthsReq && ref.rewardStatus !== "rewarded") {
        // Max rewards per org check
        if (cfg?.maxRewardsPerOrg) {
          const rewardsGranted = await prisma.referral.count({
            where: { referrerOrgId: ref.referrerOrgId, rewardStatus: "rewarded" },
          })
          if (rewardsGranted >= cfg.maxRewardsPerOrg) {
            await prisma.referral.update({
              where: { id: ref.id },
              data: { rewardStatus: "disqualified", disqualifiedAt: now, disqualifiedReason: "Referrer has reached maximum rewards limit" },
            })
            referralResults.push({ id: ref.id, action: "disqualified_max_rewards" })
            continue
          }
        }

        // Max rewards per year check
        if (cfg?.maxRewardsPerYear) {
          const yearStart = new Date(now.getFullYear(), 0, 1)
          const rewardsThisYear = await prisma.referral.count({
            where: { referrerOrgId: ref.referrerOrgId, rewardStatus: "rewarded", rewardDate: { gte: yearStart } },
          })
          if (rewardsThisYear >= cfg.maxRewardsPerYear) {
            referralResults.push({ id: ref.id, action: "skipped_year_limit" })
            continue
          }
        }

        if (!systemSA) { referralResults.push({ id: ref.id, action: "skipped_no_sa" }); continue }

        // Mark qualified then reward
        await prisma.referral.update({ where: { id: ref.id }, data: { qualifiedAt: now } })

        try {
          const result = await triggerReferralReward(ref.id, systemSA.id)
          if (!result.ok) {
            referralResults.push({ id: ref.id, action: "reward_failed", error: result.error })
            continue
          }

          // Notify both orgs
          const referrerAdmin = ref.referrerOrg.users[0]
          const referredAdmin = referred.users[0]
          const rewardDesc    = `${cfg?.referrerRewardValue ?? 1} free billing cycle`

          if (referrerAdmin?.email) {
            sendEmail({
              ...referralRewardReferrerEmail({
                referrerAdminName: referrerAdmin.name ?? ref.referrerOrg.name,
                referrerOrgName:   ref.referrerOrg.name,
                referredOrgName:   referred.name,
                rewardDescription: rewardDesc,
                dashboardUrl:      `${appUrl}/referrals`,
              }),
              to: referrerAdmin.email,
            }).catch(console.error)
          }

          if (referredAdmin?.email) {
            sendEmail({
              ...referralRewardReferredEmail({
                referredAdminName: referredAdmin.name ?? referred.name,
                referredOrgName:   referred.name,
                referrerOrgName:   ref.referrerOrg.name,
                rewardDescription: rewardDesc,
                dashboardUrl:      `${appUrl}/referrals`,
              }),
              to: referredAdmin.email,
            }).catch(console.error)
          }

          referralResults.push({ id: ref.id, action: "rewarded" })
        } catch (err) {
          referralResults.push({ id: ref.id, action: "error", error: err instanceof Error ? err.message : String(err) })
        }
      }
    }
  }

  // ── 3. Send 7-day expiry warning emails ──────────────────────────────────────
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
