// Subscription-access decisions (Phase D) — the "brain" of enforcement, kept
// pure and tested. NOTHING here is wired into a guard yet, and the master switch
// is OFF by default, so importing or evaluating these functions changes no one's
// access. Turning enforcement on is a deliberate, separate step taken only AFTER
// the legacy-org transition backfill is approved and applied.
//
// Stripe is the source of truth: access derives from the subscription state the
// webhook/reconcile has already synced onto the Organization — never from the
// frontend. The intended call sites are the server-side guards (APIs + server
// actions), so enforcement holds regardless of the UI.

import { includedSeatsFor, maxSeatsFor } from "./plans"

/**
 * Master switch. OFF unless CLEANING_SUBSCRIPTION_ENFORCEMENT === "on". While
 * off, guards must treat every org as allowed (enforcement is a no-op), so this
 * whole subsystem can ship dark and be exercised in tests without affecting a
 * single real request.
 */
export function isSubscriptionEnforcementEnabled(): boolean {
  return process.env.CLEANING_SUBSCRIPTION_ENFORCEMENT === "on"
}

export type OrgAccessInput = {
  isDemo: boolean
  subscriptionStatus: string
  trialEndsAt: Date | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Date | null
}

export type AccessResult = { allowed: boolean; reason: string }

/**
 * Decide whether an org may use OPERATIONAL functions, given its synced
 * subscription state. Independent of the master switch — callers apply it only
 * when enforcement is enabled, and always after exempting admin billing/export.
 *
 *   • Demo orgs: always allowed (sandbox; time-limited elsewhere by demoExpiresAt).
 *     Demo status grants only demo access and is set at provisioning — it is not
 *     a flag a real customer can flip to dodge billing.
 *   • Paid: subscriptionStatus "active" AND a real Stripe subscription on file
 *     AND not past the paid-through date (currentPeriodEnd).
 *   • Trial (incl. the legacy 14-day grace, represented as trialing + a bounded
 *     trialEndsAt): subscriptionStatus "trialing" AND trialEndsAt in the future.
 *   • Everything else (expired trial, past_due, canceled, or "active" with NO
 *     Stripe subscription — e.g. an un-migrated legacy org): NOT allowed.
 *
 * Note the deliberate consequence: a legacy org still carrying the old
 * subscriptionStatus "active" with no Stripe subscription is DENIED here. That is
 * exactly why enforcement must not be switched on until the approved transition
 * backfill has moved such orgs to "trialing" with a grace date.
 */
export function subscriptionAccess(org: OrgAccessInput, now: Date = new Date()): AccessResult {
  if (org.isDemo) return { allowed: true, reason: "demo sandbox" }

  if (
    org.subscriptionStatus === "active" &&
    org.stripeSubscriptionId &&
    (!org.currentPeriodEnd || org.currentPeriodEnd > now)
  ) {
    return { allowed: true, reason: "active paid subscription" }
  }

  if (org.subscriptionStatus === "trialing" && org.trialEndsAt && org.trialEndsAt > now) {
    return { allowed: true, reason: "trial in progress" }
  }

  return { allowed: false, reason: "no active subscription or valid trial" }
}

/**
 * The seat ceiling for an org: included seats for the tier plus Stripe-purchased
 * extra seats, never above the tier's hard maximum. `purchasedSeats` is the value
 * synced from the org's actual Stripe subscription quantity (see data/subscription),
 * so additional seats are validated against real billing, not a client claim.
 */
export function seatLimit(tier: string, purchasedSeats: number): number {
  const included = includedSeatsFor(tier)
  const max = maxSeatsFor(tier)
  const requested = included + Math.max(0, purchasedSeats)
  return Math.min(requested, max)
}

/**
 * Whether another active staff seat may be created, given the current count of
 * active non-CLIENT users. Customer-portal (CLIENT) users never count toward the
 * limit — callers must pass a count that already excludes them.
 */
export function canAddActiveSeat(
  tier: string,
  purchasedSeats: number,
  currentActiveNonClientCount: number,
): boolean {
  return currentActiveNonClientCount < seatLimit(tier, purchasedSeats)
}

// ── Pure guard outcomes ──────────────────────────────────────────────────────
// The DB + HTTP glue (subscription/enforce.ts, data/seats.ts) stays trivial by
// delegating every decision to these pure functions, which are unit-tested here
// rather than through a mocked database.

/**
 * Decide whether the subscription gate should BLOCK a request. Independent of
 * transport. Fails OPEN in two deliberate cases so enforcement can never lock a
 * customer out by accident:
 *   • enforcement master switch off → never block (ships dark);
 *   • org state unresolved (null) → never block (a data/read glitch is not
 *     evidence of non-payment, and must not strand account recovery).
 * Admin recovery: a denied org whose actor is an administrator is let through on
 * routes flagged `recovery` (billing, payment-method, data export) so admins can
 * always reach the controls needed to pay or export, even while lapsed.
 */
export function subscriptionGuardOutcome(params: {
  enforcementEnabled: boolean
  org: OrgAccessInput | null
  now: Date
  recovery: boolean
  actorIsAdmin: boolean
}): { block: false } | { block: true; reason: string } {
  if (!params.enforcementEnabled) return { block: false }
  if (!params.org) return { block: false }
  const access = subscriptionAccess(params.org, params.now)
  if (access.allowed) return { block: false }
  if (params.recovery && params.actorIsAdmin) return { block: false }
  return { block: true, reason: access.reason }
}

/**
 * Decide whether activating another staff seat should BLOCK. Off while the master
 * switch is off; demo orgs are exempt (sandbox). `currentActiveNonClientCount`
 * must already EXCLUDE portal/CLIENT users and inactive users — seats count only
 * active staff.
 */
export function seatActivationOutcome(params: {
  enforcementEnabled: boolean
  isDemo: boolean
  tier: string
  purchasedSeats: number
  currentActiveNonClientCount: number
}): { block: false } | { block: true; limit: number } {
  if (!params.enforcementEnabled) return { block: false }
  if (params.isDemo) return { block: false }
  if (canAddActiveSeat(params.tier, params.purchasedSeats, params.currentActiveNonClientCount)) {
    return { block: false }
  }
  return { block: true, limit: seatLimit(params.tier, params.purchasedSeats) }
}
