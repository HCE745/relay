// Pure translation + decision logic for syncing Stripe subscription state onto
// an Organization. No DB, no network, no process side effects beyond reading
// price env vars — so every rule here is unit-tested directly. The webhook
// (src/app/api/billing/webhook) and the data wrapper (src/lib/data/subscription)
// use these; Stripe is always the source of truth.

import { purchasablePlans, type BillingInterval, type BillingTier } from "./plans"

// Minimal shapes of the Stripe objects we read (we never trust more than this).
export type StripeSubscriptionItem = {
  price?: { id?: string } | null
  quantity?: number | null
  current_period_end?: number | null // some API versions carry the period here
}
export type StripeSubscription = {
  id?: string
  customer?: string | { id?: string } | null
  status?: string
  current_period_end?: number | null
  cancel_at_period_end?: boolean | null
  items?: { data?: StripeSubscriptionItem[] } | null
  metadata?: Record<string, string> | null
}

export type StripeEvent = {
  id: string
  type: string
  data?: { object?: Record<string, unknown> } | null
}

/** What we resolve a plan's Stripe price id into. */
export type PriceMeaning = { tier: BillingTier; interval: BillingInterval; isSeat: boolean }

/** The org columns a subscription maps to. `packageTier`/`billingInterval` are
 *  undefined when the base price is unknown (never guess the tier). */
export type OrgSubscriptionFields = {
  orgId: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  packageTier?: BillingTier
  billingInterval?: BillingInterval
  subscriptionStatus: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  purchasedSeats: number
}

/**
 * Build a priceId → meaning lookup from the configured env vars. Prices that are
 * not configured are simply absent (tolerant), so a partial env never throws
 * here — the webhook degrades to "leave tier unchanged" rather than crashing.
 */
export function buildPriceLookup(): Map<string, PriceMeaning> {
  const map = new Map<string, PriceMeaning>()
  for (const plan of purchasablePlans()) {
    for (const interval of ["monthly", "annual"] as const) {
      const base = process.env[plan.priceEnv[interval]]
      if (base) map.set(base, { tier: plan.tier, interval, isSeat: false })
      const seatEnv = plan.seatAddOn?.priceEnv[interval]
      const seat = seatEnv ? process.env[seatEnv] : undefined
      if (seat) map.set(seat, { tier: plan.tier, interval, isSeat: true })
    }
  }
  return map
}

/** Map Stripe's subscription.status onto our coarse status string. */
export function mapSubscriptionStatus(stripeStatus: string | undefined): string {
  switch (stripeStatus) {
    case "trialing":
      return "trialing"
    case "active":
      return "active"
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return "past_due"
    case "canceled":
    case "incomplete_expired":
      return "canceled"
    default:
      return "past_due" // unknown → treat as needing attention, never silently "active"
  }
}

function customerId(c: StripeSubscription["customer"]): string | null {
  if (!c) return null
  return typeof c === "string" ? c : (c.id ?? null)
}

/**
 * Translate an authoritative Stripe subscription into the org fields to persist.
 * Because the webhook always re-fetches the live subscription before calling
 * this, the result reflects CURRENT Stripe state — which makes out-of-order
 * webhook delivery harmless (a late event still writes today's truth).
 */
export function subscriptionToOrgFields(
  sub: StripeSubscription,
  lookup: Map<string, PriceMeaning>,
): OrgSubscriptionFields {
  const items = sub.items?.data ?? []
  let base: PriceMeaning | undefined
  let purchasedSeats = 0
  let periodEnd: number | null = sub.current_period_end ?? null

  for (const item of items) {
    const meaning = item.price?.id ? lookup.get(item.price.id) : undefined
    if (meaning?.isSeat === false) base = meaning
    else if (meaning?.isSeat === true) purchasedSeats = Math.max(0, item.quantity ?? 0)
    if (periodEnd == null && item.current_period_end != null) periodEnd = item.current_period_end
  }

  return {
    orgId: sub.metadata?.orgId ?? null,
    stripeCustomerId: customerId(sub.customer),
    stripeSubscriptionId: sub.id ?? null,
    packageTier: base?.tier,
    billingInterval: base?.interval,
    subscriptionStatus: mapSubscriptionStatus(sub.status),
    currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    purchasedSeats,
  }
}

/**
 * Which subscription id (if any) a billing event is about — i.e. the id to
 * re-fetch for authoritative state. Returns null for events we don't act on, so
 * the webhook acknowledges them (stops Stripe retrying) without doing work.
 * Only subscription-mode checkouts are handled here; one-off invoice payments
 * belong to the SEPARATE customer-invoice webhook.
 */
export function subscriptionIdFromEvent(event: StripeEvent): string | null {
  const obj = (event.data?.object ?? {}) as Record<string, unknown>
  switch (event.type) {
    case "checkout.session.completed":
      if (obj.mode !== "subscription") return null
      return typeof obj.subscription === "string" ? obj.subscription : null
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return typeof obj.id === "string" ? obj.id : null
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return typeof obj.subscription === "string" ? obj.subscription : null
    default:
      return null
  }
}

export type SubscriptionUpdateDecision =
  | { action: "update"; data: OrgSubscriptionFields }
  | { action: "skip"; reason: string }

/**
 * Decide whether to apply a subscription's fields to an org — the duplicate
 * guard. An org is bound to at most one live subscription: if it already has a
 * DIFFERENT subscription that is active/trialing, a second one is refused rather
 * than allowed to hijack the record. Terminal states (canceled) never block
 * rebinding, so a resubscribe after cancellation works.
 */
export function decideSubscriptionUpdate(
  org: { stripeSubscriptionId: string | null; subscriptionStatus: string },
  fields: OrgSubscriptionFields,
): SubscriptionUpdateDecision {
  const incoming = fields.stripeSubscriptionId
  const current = org.stripeSubscriptionId
  const currentIsLive = org.subscriptionStatus === "active" || org.subscriptionStatus === "trialing"

  if (current && incoming && current !== incoming && currentIsLive) {
    return {
      action: "skip",
      reason: `org already bound to live subscription ${current}; refusing duplicate ${incoming}`,
    }
  }
  return { action: "update", data: fields }
}
