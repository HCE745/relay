import { requireOrgAdmin } from "@/lib/guards"
import { ok, forbidden, badRequest } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { isBillingConfigured, createBillingPortalSession } from "@/lib/subscription/stripe-subscriptions"

// Open the Stripe Billing Portal so an admin can manage payment method, plan, and
// invoices. OWNER/ADMIN only, NOT subscription-gated (recovery surface), so a
// lapsed admin can always update their card. Requires an existing Stripe customer
// (created at first checkout).
function appBaseUrl(): string {
  return process.env.CLEANING_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

export async function POST() {
  const g = await requireOrgAdmin()
  if (!g.ok) return g.response
  if (!isBillingConfigured()) return forbidden("Billing isn't enabled yet.")

  const org = await prisma.organization.findUnique({
    where: { id: g.orgId },
    select: { stripeCustomerId: true },
  })
  if (!org?.stripeCustomerId) return badRequest("No billing account yet. Start a subscription first.")

  const { url } = await createBillingPortalSession({
    stripeCustomerId: org.stripeCustomerId,
    returnUrl: `${appBaseUrl()}/settings/billing`,
  })
  return ok({ url })
}
