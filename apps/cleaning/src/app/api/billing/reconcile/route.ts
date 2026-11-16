import { requireOrgAdmin } from "@/lib/guards"
import { ok, forbidden, badRequest } from "@/lib/api"
import { isBillingConfigured } from "@/lib/subscription/stripe-subscriptions"
import { reconcileSubscriptionFromStripe } from "@/lib/data/subscription"

// Administrator-only subscription recovery (the Phase C reconcile safeguard,
// surfaced securely). Re-syncs THIS org from Stripe's authoritative subscription
// state — the manual recovery path for a webhook that was never delivered.
//
// Locked down: requireOrgAdmin (OWNER/ADMIN only) and scoped to the caller's own
// org (orgId comes from the session, never the request body), so an ordinary user
// cannot reach it and no one can reconcile another tenant. Deliberately NOT
// subscription-gated — a lapsed admin must be able to self-heal.
export async function POST() {
  const g = await requireOrgAdmin()
  if (!g.ok) return g.response
  if (!isBillingConfigured()) return forbidden("Billing is not configured")

  const result = await reconcileSubscriptionFromStripe(g.orgId)
  if (!result.reconciled) return badRequest(result.reason ?? "Nothing to reconcile")
  return ok({ reconciled: true })
}
