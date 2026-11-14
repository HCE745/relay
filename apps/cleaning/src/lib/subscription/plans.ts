// CleanWare SaaS subscription plan registry — the single source of truth for
// what each PAID package costs and includes. This is CleanWare billing its
// cleaning-company customers for the software itself; it is entirely separate
// from the customer-invoice system (src/lib/billing-math.ts, billing-periods.ts,
// src/lib/stripe.ts), which is how a cleaning company bills ITS OWN customers.
//
// Pure data + pure helpers only: no process.env, no Stripe calls, no DB. The
// registry holds the NAMES of the Stripe Price-ID env vars (resolved at call
// time in stripe-subscriptions.ts), never the secret values — so this file is
// trivially testable and safe to import anywhere.
//
// Tier codes mirror Organization.packageTier / the entitlement matrix:
//   SOLO = "Solo"  TEAM = "Essentials"  BUSINESS = "Professional"
// ENTERPRISE is contact-sales (no self-serve price) and is intentionally absent.

export type BillingTier = "SOLO" | "TEAM" | "BUSINESS"
export type BillingInterval = "monthly" | "annual"

/** Per-extra-seat add-on, for tiers that allow buying seats beyond the included
 *  count. `maxSeats` is the hard cap on TOTAL active staff seats for the tier. */
export type SeatAddOn = {
  priceEnv: Record<BillingInterval, string> // Stripe Price-ID env var names
  amountCents: Record<BillingInterval, number> // per extra seat, for display
  maxSeats: number // hard cap on total seats (included + purchased)
}

export type BillingPlan = {
  tier: BillingTier
  name: string // customer-facing name
  priceEnv: Record<BillingInterval, string> // base Stripe Price-ID env var names
  amountCents: Record<BillingInterval, number> // base price, for display
  includedSeats: number // active non-CLIENT users included
  seatAddOn: SeatAddOn | null // null = no add-on (upgrade required to grow)
  // FUTURE CONFIG — enforcement intentionally DISABLED until a real operating-
  // location / branch entity exists. Customer cleaning sites are unlimited on
  // every plan and are NEVER counted against this. Carried here so the allowance
  // is defined in one place when multi-location ships; see docs/standing notes.
  includedOperatingLocations: number
}

const PLANS: Record<BillingTier, BillingPlan> = {
  SOLO: {
    tier: "SOLO",
    name: "Solo",
    priceEnv: {
      monthly: "STRIPE_BILLING_PRICE_SOLO_MONTHLY",
      annual: "STRIPE_BILLING_PRICE_SOLO_ANNUAL",
    },
    amountCents: { monthly: 4900, annual: 49980 },
    includedSeats: 3,
    seatAddOn: null, // beyond 3 users: upgrade to Essentials (no per-seat add-on)
    includedOperatingLocations: 1,
  },
  TEAM: {
    tier: "TEAM",
    name: "Essentials",
    priceEnv: {
      monthly: "STRIPE_BILLING_PRICE_ESSENTIALS_MONTHLY",
      annual: "STRIPE_BILLING_PRICE_ESSENTIALS_ANNUAL",
    },
    amountCents: { monthly: 9900, annual: 100980 },
    includedSeats: 10,
    seatAddOn: {
      priceEnv: {
        monthly: "STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_MONTHLY",
        annual: "STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_ANNUAL",
      },
      amountCents: { monthly: 500, annual: 5100 },
      maxSeats: 24,
    },
    includedOperatingLocations: 2,
  },
  BUSINESS: {
    tier: "BUSINESS",
    name: "Professional",
    priceEnv: {
      monthly: "STRIPE_BILLING_PRICE_PROFESSIONAL_MONTHLY",
      annual: "STRIPE_BILLING_PRICE_PROFESSIONAL_ANNUAL",
    },
    amountCents: { monthly: 19900, annual: 202980 },
    includedSeats: 25,
    seatAddOn: {
      priceEnv: {
        monthly: "STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_MONTHLY",
        annual: "STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_ANNUAL",
      },
      amountCents: { monthly: 400, annual: 4080 },
      maxSeats: 100,
    },
    includedOperatingLocations: 4,
  },
}

/** Length of the no-credit-card free trial, in days. */
export const TRIAL_DAYS = 14

const PURCHASABLE: BillingTier[] = ["SOLO", "TEAM", "BUSINESS"]

/** All self-serve purchasable plans, in ascending order. (Enterprise is contact-sales.) */
export function purchasablePlans(): BillingPlan[] {
  return PURCHASABLE.map((t) => PLANS[t])
}

/** A plan by tier code, or null for a non-purchasable/unknown tier (e.g. ENTERPRISE). */
export function getPlan(tier: string): BillingPlan | null {
  return (PLANS as Record<string, BillingPlan>)[tier] ?? null
}

/** True if the tier is a self-serve purchasable plan (not ENTERPRISE/unknown). */
export function isPurchasableTier(tier: string): tier is BillingTier {
  return Object.prototype.hasOwnProperty.call(PLANS, tier)
}

/** Seats included in the tier; 0 for a non-purchasable tier. */
export function includedSeatsFor(tier: string): number {
  return getPlan(tier)?.includedSeats ?? 0
}

/**
 * The hard cap on total active staff seats for a tier: the add-on `maxSeats`
 * where seats can be purchased, otherwise just the included count. 0 for an
 * unknown tier. (ENTERPRISE is contact-sales and not represented here.)
 */
export function maxSeatsFor(tier: string): number {
  const plan = getPlan(tier)
  if (!plan) return 0
  return plan.seatAddOn ? plan.seatAddOn.maxSeats : plan.includedSeats
}
