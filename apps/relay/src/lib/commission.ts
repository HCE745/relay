// Commission tracking helpers shared across API routes.

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"

export const ATTRIBUTION_LOCK_HOURS = 48

/** Creates a CommissionAttribution when a deal closes and the rep is commission-eligible. */
export async function createAttribution(opportunityId: string, commissionOwnerId: string): Promise<void> {
  const rep = await prisma.salesUser.findUnique({
    where: { id: commissionOwnerId },
    select: { commissionEligible: true, commissionRate: true, employmentStatus: true },
  })
  if (!rep?.commissionEligible || rep.employmentStatus !== "ACTIVE") return

  const lockedAt = new Date(Date.now() + ATTRIBUTION_LOCK_HOURS * 60 * 60 * 1000)

  await prisma.commissionAttribution.upsert({
    where: { opportunityId },
    create: {
      opportunityId,
      commissionOwnerId,
      commissionRate: rep.commissionRate,
      attributionStatus: "PENDING",
      attributionReason: "NORMAL_CLOSE",
      attributionLockedAt: lockedAt,
    },
    update: {},
  })
}

/**
 * Creates a CommissionPayment from a Stripe invoice.payment_succeeded event.
 * Silently skips (with Sentry capture) if no eligible attribution exists.
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
    // Find a Closed Won opp linked to this org with an active PENDING or APPROVED attribution
    const opp = await prisma.crmOpportunity.findFirst({
      where: {
        customerOrganizationId: orgId,
        stage: "Closed Won",
        commissionEligible: true,
        attribution: {
          attributionStatus: { in: ["PENDING", "APPROVED"] },
          commissionOwner: {
            commissionEligible: true,
            employmentStatus: "ACTIVE",
          },
        },
      },
      include: {
        attribution: {
          include: { commissionOwner: true },
        },
      },
    })

    if (!opp?.attribution) return

    const attribution = opp.attribution
    const grossRevenue = grossRevenueCents / 100
    const commissionAmount = (grossRevenue * Number(attribution.commissionRate)) / 100

    await prisma.commissionPayment.create({
      data: {
        attributionId: attribution.id,
        stripePaymentIntentId,
        grossRevenue,
        commissionRate: attribution.commissionRate,
        commissionAmount,
        commissionStatus: "PENDING",
        paymentReceivedAt,
        periodStart,
        periodEnd,
      },
    })
  } catch (err) {
    Sentry.captureException(err, { extra: { orgId, context: "commission_payment_creation" } })
  }
}
