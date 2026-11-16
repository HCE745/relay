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
 * The tier a no-card trial starts on. Essentials (TEAM) gives a meaningful
 * mid-tier evaluation (employees, field app, inspections, portal) without
 * unlocking the top ERP tier. Changeable here as a product decision.
 */
export const TRIAL_TIER: BillingTier = "TEAM"

/** Build a collision-resistant org slug from a company name + a random suffix. */
export function buildOrgSlug(orgName: string, randomSuffix: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${base || "org"}-${randomSuffix}`
}
