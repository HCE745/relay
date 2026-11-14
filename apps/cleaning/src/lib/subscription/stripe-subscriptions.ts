// CleanWare SaaS billing — the Stripe client for the SUBSCRIPTION system, which
// is a SEPARATE Stripe account/configuration from the customer-invoice flow.
// It reads its own env vars and never shares them with src/lib/stripe.ts:
//
//   STRIPE_BILLING_SECRET_KEY      (sk_...)   — create subscription Checkout / portal sessions
//   STRIPE_BILLING_WEBHOOK_SECRET  (whsec_...) — verify inbound subscription webhooks
//   CLEANING_APP_URL                          — base for success/return redirects
//   STRIPE_BILLING_PRICE_*                    — the ten Price IDs (see plans.ts)
//
// Signature verification is shared code (verifyStripeSignature) but is always
// called with the BILLING webhook secret here, so the two Stripe accounts stay
// cryptographically independent. Nothing in this module touches the invoice
// Checkout path, its env vars, or its webhook.

import { verifyStripeSignature } from "../stripe"
import {
  getPlan,
  isPurchasableTier,
  maxSeatsFor,
  type BillingInterval,
  type BillingTier,
} from "./plans"

const STRIPE_API = "https://api.stripe.com/v1"

/** True only when the SaaS billing Stripe account is configured. Distinct from
 *  isStripeConfigured() (the invoice account). */
export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_BILLING_SECRET_KEY
}

/** Resolve a Stripe Price ID from an env var NAME, throwing loudly if unset — a
 *  missing price mapping is a deploy misconfiguration, never a silent fallback. */
export function resolvePriceId(envName: string): string {
  const value = process.env[envName]
  if (!value) throw new Error(`Missing Stripe price env var: ${envName}`)
  return value
}

/** Verify a subscription-webhook signature using the BILLING secret only. */
export function verifyBillingSignature(rawBody: string, header: string | null): boolean {
  return verifyStripeSignature(rawBody, header, { secret: process.env.STRIPE_BILLING_WEBHOOK_SECRET })
}

function billingKey(): string {
  const key = process.env.STRIPE_BILLING_SECRET_KEY
  if (!key) throw new Error("STRIPE_BILLING_SECRET_KEY is not set")
  return key
}

async function stripePost(
  path: string,
  form: URLSearchParams,
  opts: { idempotencyKey?: string } = {},
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${billingKey()}`,
    "content-type": "application/x-www-form-urlencoded",
  }
  // Stripe idempotency: a retried POST with the same key returns the original
  // result instead of creating a second object — our guard against duplicate
  // subscriptions on double-submit or network retry.
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey

  const res = await fetch(`${STRIPE_API}${path}`, { method: "POST", headers, body: form.toString() })
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok || !data) {
    const message =
      (data?.error as { message?: string } | undefined)?.message ?? `Stripe error ${res.status}`
    throw new Error(message)
  }
  return data
}

export type SubscriptionCheckoutInput = {
  orgId: string
  tier: BillingTier
  interval: BillingInterval
  /** Extra seats beyond the plan's included count (add-on line). 0 = none. */
  extraSeats?: number
  successUrl: string
  cancelUrl: string
  /** Reuse an existing Stripe customer (from a prior checkout) when known. */
  stripeCustomerId?: string
  /** Prefill the email when no customer exists yet (Stripe creates the customer). */
  customerEmail?: string
  /** Remaining free-trial days to carry onto the subscription, so adding a card
   *  mid-trial does NOT charge immediately. Omit for immediate first-period billing. */
  trialPeriodDays?: number
  /** Idempotency key (e.g. `sub-checkout:<orgId>`) — blocks duplicate subscriptions. */
  idempotencyKey?: string
}

/**
 * Create a Stripe Checkout Session in SUBSCRIPTION mode for a CleanWare plan.
 * Line 0 is the base plan; line 1 (optional) is the per-seat add-on for the
 * requested extra seats. Returns the hosted Checkout URL.
 */
export async function createSubscriptionCheckout(
  input: SubscriptionCheckoutInput,
): Promise<{ id: string; url: string }> {
  const plan = getPlan(input.tier)
  if (!plan || !isPurchasableTier(input.tier)) {
    throw new Error(`Tier is not self-serve purchasable: ${input.tier}`)
  }

  const extraSeats = Math.max(0, Math.floor(input.extraSeats ?? 0))
  if (extraSeats > 0) {
    if (!plan.seatAddOn) throw new Error(`${plan.name} has no per-seat add-on; upgrade required`)
    const totalSeats = plan.includedSeats + extraSeats
    const cap = maxSeatsFor(input.tier)
    if (totalSeats > cap) {
      throw new Error(`Requested ${totalSeats} seats exceeds the ${plan.name} maximum of ${cap}`)
    }
  }

  const form = new URLSearchParams()
  form.set("mode", "subscription")
  form.set("success_url", input.successUrl)
  form.set("cancel_url", input.cancelUrl)
  form.set("client_reference_id", input.orgId)
  form.set("metadata[orgId]", input.orgId)
  form.set("metadata[tier]", input.tier)
  form.set("metadata[interval]", input.interval)
  // Mirror metadata onto the subscription itself, for webhook reconciliation.
  form.set("subscription_data[metadata][orgId]", input.orgId)
  form.set("subscription_data[metadata][tier]", input.tier)
  form.set("subscription_data[metadata][interval]", input.interval)

  if (input.stripeCustomerId) form.set("customer", input.stripeCustomerId)
  else if (input.customerEmail) form.set("customer_email", input.customerEmail)

  if (typeof input.trialPeriodDays === "number" && input.trialPeriodDays > 0) {
    form.set("subscription_data[trial_period_days]", String(Math.floor(input.trialPeriodDays)))
  }

  // Base plan line.
  form.set("line_items[0][price]", resolvePriceId(plan.priceEnv[input.interval]))
  form.set("line_items[0][quantity]", "1")
  // Per-seat add-on line (only when buying extra seats).
  if (extraSeats > 0 && plan.seatAddOn) {
    form.set("line_items[1][price]", resolvePriceId(plan.seatAddOn.priceEnv[input.interval]))
    form.set("line_items[1][quantity]", String(extraSeats))
  }

  const data = await stripePost("/checkout/sessions", form, { idempotencyKey: input.idempotencyKey })
  const id = typeof data.id === "string" ? data.id : null
  const url = typeof data.url === "string" ? data.url : null
  if (!id || !url) throw new Error("Stripe did not return a Checkout URL")
  return { id, url }
}

/**
 * Create a Stripe Billing Portal session so an admin can manage payment methods,
 * upgrade/downgrade, and cancel. Returns the hosted portal URL.
 */
export async function createBillingPortalSession(input: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const form = new URLSearchParams()
  form.set("customer", input.stripeCustomerId)
  form.set("return_url", input.returnUrl)
  const data = await stripePost("/billing_portal/sessions", form)
  const url = typeof data.url === "string" ? data.url : null
  if (!url) throw new Error("Stripe did not return a portal URL")
  return { url }
}
