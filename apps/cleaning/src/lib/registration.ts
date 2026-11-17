// Self-service registration config + helpers (Phase E). Pure and testable; no DB.
//
// Public registration ships DARK: the master switch below is OFF unless
// CLEANING_PUBLIC_REGISTRATION === "on". While off, the /signup surface refuses
// and the sales-assisted /register (bootstrap-token) path is the only way in.
// Turning it on is a deliberate, separate step, taken only with explicit approval
// — exactly like subscription enforcement and live billing.

import type { BillingTier } from "./subscription/plans"

/** Master switch for public self-service registration. OFF by default. */
export function isPublicRegistrationEnabled(): boolean {
  return process.env.CLEANING_PUBLIC_REGISTRATION === "on"
}

/**
 * The DEFAULT tier a no-card trial starts on when the signer picks nothing.
 * Essentials (TEAM) gives a meaningful mid-tier evaluation (employees, field app,
 * inspections, portal) without unlocking the top ERP tier. The signup form lets
 * the customer choose Solo / Essentials / Professional instead; this is only the
 * fallback. Changeable here as a product decision.
 */
export const TRIAL_TIER: BillingTier = "TEAM"

/** The tiers a self-serve trial may start on (ENTERPRISE is contact-sales). */
const TRIALABLE_TIERS: readonly BillingTier[] = ["SOLO", "TEAM", "BUSINESS"]

/**
 * Validate a requested trial tier, falling back to TRIAL_TIER for anything that
 * isn't a self-serve purchasable tier. A defensive second gate behind the zod
 * schema so the DB layer never persists an off-menu packageTier.
 */
export function coerceTrialTier(value: unknown): BillingTier {
  return typeof value === "string" && (TRIALABLE_TIERS as readonly string[]).includes(value)
    ? (value as BillingTier)
    : TRIAL_TIER
}

/** Build a collision-resistant org slug from a company name + a random suffix. */
export function buildOrgSlug(orgName: string, randomSuffix: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${base || "org"}-${randomSuffix}`
}
