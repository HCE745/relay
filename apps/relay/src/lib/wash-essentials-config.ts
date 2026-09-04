/**
 * Central Wash Essentials configuration.
 * Import pricing constants and Stripe helpers from here — never hardcode them elsewhere.
 */

// ── Pricing ───────────────────────────────────────────────────────────────────
export const WE_BASE_PRICE_USD     = 40
export const WE_LOCATION_PRICE_USD = 10
export const WE_MAX_LOCATIONS      = 7
export const WE_INCLUDED_LOCATIONS = 1

// ── Stripe price IDs (read at call time so env is loaded) ─────────────────────
export function getWeBaseStripePrice():     string { return process.env.STRIPE_PRICE_WASH_ESSENTIALS          ?? "" }
export function getWeLocationStripePrice(): string { return process.env.STRIPE_PRICE_WASH_ESSENTIALS_LOCATION ?? "" }

/** Returns true when the given Stripe price ID belongs to either WE price. */
export function isWeStripePrice(priceId: string): boolean {
  const base = getWeBaseStripePrice()
  const loc  = getWeLocationStripePrice()
  return (!!base && priceId === base) || (!!loc && priceId === loc)
}

/** Returns true when the given Stripe price ID is the WE per-location add-on. */
export function isWeLocationStripePrice(priceId: string): boolean {
  const loc = getWeLocationStripePrice()
  return !!loc && priceId === loc
}

// ── Nav / route blocking ──────────────────────────────────────────────────────
// Paths not available in the Wash Essentials product line.
// Kept in sync with the proxy middleware WASH_ESSENTIALS_BLOCKED list.
export const WE_BLOCKED_PATHS = [
  "/departments",
  "/sops",
  "/purchase-requests",
  "/vendors",
] as const

// ── Feature flags included in Wash Essentials ─────────────────────────────────
// These are the org boolean flags that should be enabled for WE orgs.
// All others default to false (blocked / not applicable).
export const WE_INCLUDED_FEATURE_FLAGS = [
  "qr_codes_enabled",
  "aiSuggestionsAvailable",
] as const
