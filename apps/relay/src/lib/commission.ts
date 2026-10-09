// Commission tracking helpers shared across API routes.

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"

export const ATTRIBUTION_LOCK_HOURS = 48

/** Creates a CommissionAttribution when a deal closes and the rep is commission-eligible.
 *  Idempotent: skips if an attribution already exists for this owner + opportunity. */
export async function createAttribution(opportunityId: string, commissionOwnerId: string): Promise<void> {
  const rep = await prisma.salesUser.findUnique({
    where: { id: commissionOwnerId },
    select: { commissionEligible: true, commissionRate: true, employmentStatus: true, commissionDuration: true },
  })
  if (!rep?.commissionEligible || rep.employmentStatus !== "ACTIVE") return

  const existing = await prisma.commissionAttribution.findFirst({
    where: { opportunityId, commissionOwnerId },
  })
  if (existing) return

  const lockedAt = new Date(Date.now() + ATTRIBUTION_LOCK_HOURS * 60 * 60 * 1000)

  await prisma.commissionAttribution.create({
    data: {
      opportunityId,
      commissionOwnerId,
      commissionRate: rep.commissionRate,
      splitPercent: 100,
      attributionStatus: "PENDING",
      attributionReason: "NORMAL_CLOSE",
      attributionLockedAt: lockedAt,
    },
  })
}

/**
 * Creates CommissionPayment records from a Stripe invoice.payment_succeeded event.
 * Silently skips (with Sentry capture) if no eligible attributions exist.
 * Supports multiple attributions per opportunity (splits). Each attribution's
 * payment = grossRevenue * (splitPercent / 100) * (commissionRate / 100).
 * Excludes payments received after commissionEndDate.
 * Auto-sets commissionEndDate for FIRST_YEAR reps on their first payment.
 */
export async function createCommissionPaymentFromStripe(params: {
  orgId: string
  stripePaymentIntentId: string | null
  grossRevenueCents: number
  periodStart: Date | null
  periodEnd: Date | null
  paymentReceivedAt: Date
}): Promise<void> {
  const { orgId, stripePaymentIntentId, grossRevenueCents, periodStart, periodEnd, paymentReceivedAt } = params

  try {
    const opp = await prisma.crmOpportunity.findFirst({
      where: {
        customerOrganizationId: orgId,
        stage: "Closed Won",
        commissionEligible: true,
        attributions: {
          some: {
            attributionStatus: { in: ["PENDING", "APPROVED"] },
            commissionOwner: { commissionEligible: true, employmentStatus: "ACTIVE" },
          },
        },
      },
      include: {
        attributions: {
          where: {
            attributionStatus: { in: ["PENDING", "APPROVED"] },
            commissionOwner: { commissionEligible: true, employmentStatus: "ACTIVE" },
          },
          include: { commissionOwner: { select: { commissionDuration: true } } },
        },
      },
    })

    if (!opp?.attributions.length) return

    const grossRevenue = grossRevenueCents / 100

    for (const attribution of opp.attributions) {
      // Handle FIRST_YEAR: set commissionEndDate on first payment
      if (
        attribution.commissionOwner.commissionDuration === "FIRST_YEAR" &&
        !attribution.commissionEndDate
      ) {
        const endDate = new Date(paymentReceivedAt)
        endDate.setFullYear(endDate.getFullYear() + 1)
        await prisma.commissionAttribution.update({
          where: { id: attribution.id },
          data: { commissionEndDate: endDate },
        })
        attribution.commissionEndDate = endDate
      }

      // Skip if payment is after commissionEndDate
      if (attribution.commissionEndDate && attribution.commissionEndDate < paymentReceivedAt) continue
      // Skip if payment is before commissionStartDate
      if (attribution.commissionStartDate && attribution.commissionStartDate > paymentReceivedAt) continue

      // Each attribution earns commission on its attributed portion of revenue
      const attributedRevenue = grossRevenue * (attribution.splitPercent / 100)
      const commissionAmount = (attributedRevenue * Number(attribution.commissionRate)) / 100

      await prisma.commissionPayment.create({
        data: {
          attributionId: attribution.id,
          stripePaymentIntentId,
          grossRevenue: attributedRevenue,
          commissionRate: attribution.commissionRate,
          commissionAmount,
          commissionStatus: "PENDING",
          paymentReceivedAt,
          periodStart,
          periodEnd,
        },
      })
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { orgId, context: "commission_payment_creation" } })
  }
}
