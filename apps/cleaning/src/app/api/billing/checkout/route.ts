import { requireOrgAdmin } from "@/lib/guards"
import { parseBody, ok, forbidden } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { billingCheckoutSchema } from "@/lib/zod-schemas"
import { isBillingConfigured, createSubscriptionCheckout, trialEndForCheckout } from "@/lib/subscription/stripe-subscriptions"

// Start a Stripe Checkout (subscription mode) to put a card on file / upgrade.
// OWNER/ADMIN only, and NOT subscription-gated (requireOrgAdmin is the recovery
// surface) so a lapsed admin can always pay. Does nothing until billing env is
// configured — live billing stays disabled until then.
function appBaseUrl(): string {
  return process.env.CLEANING_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

export async function POST(request: Request) {
  const g = await requireOrgAdmin()
  if (!g.ok) return g.response
  if (!isBillingConfigured()) return forbidden("Billing isn't enabled yet.")

  const body = await parseBody(billingCheckoutSchema, request)
  if (!body.ok) return body.response

  const org = await prisma.organization.findUnique({
    where: { id: g.orgId },
    select: { stripeCustomerId: true, subscriptionStatus: true, trialEndsAt: true },
  })
  if (!org) return forbidden("Organization not found")

  // Carry the EXACT remaining trial onto the subscription so adding a card
  // mid-trial charges on the original end date — never rounded up/extended.
  const trialEndUnix = trialEndForCheckout(org)

  const base = appBaseUrl()
  const { url } = await createSubscriptionCheckout({
    orgId: g.orgId,
    tier: body.data.tier,
    interval: body.data.interval,
    extraSeats: body.data.extraSeats ?? 0,
    successUrl: `${base}/settings/billing?checkout=success`,
    cancelUrl: `${base}/settings/billing?checkout=cancelled`,
    stripeCustomerId: org.stripeCustomerId ?? undefined,
    customerEmail: org.stripeCustomerId ? undefined : g.session.email,
    trialEndUnix,
  })
  return ok({ url })
}
