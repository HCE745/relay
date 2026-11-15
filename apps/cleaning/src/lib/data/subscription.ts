import { systemDb, isUniqueViolation } from "../org-db"
import {
  decideSubscriptionUpdate,
  type OrgSubscriptionFields,
} from "../subscription/sync"
import type { PackageTier } from "../entitlements/packages"

// SaaS subscription sync (Phase 50/Phase C). Platform-level writes keyed off the
// SEPARATE CleanWare billing Stripe account. Stripe is the source of truth: the
// webhook re-fetches the live subscription, maps it with subscription/sync.ts,
// and hands the fields here to persist onto the Organization.
//
// This is NOT the customer-invoice payment path (src/lib/data/payments.ts) — it
// never touches invoices. Idempotency reuses the ProcessedStripeEvent ledger,
// but under a "billing:" id prefix so a subscription event can never be confused
// with an invoice event from the other Stripe account.

const LEDGER_PREFIX = "billing:"

export type ApplyResult =
  | { applied: true }
  | { applied: false; duplicate?: true; skipped?: string }

/**
 * Apply an authoritative subscription state to its Organization, exactly once.
 * Dedupes on the Stripe event id (ProcessedStripeEvent, "billing:" namespaced);
 * a retry no-ops. Enforces the one-live-subscription-per-org duplicate guard.
 * Claiming the event even when it can't apply (org missing, duplicate sub,
 * unique clash) prevents a Stripe retry storm.
 */
export async function applySubscriptionEvent(input: {
  eventId: string
  type: string
  fields: OrgSubscriptionFields
}): Promise<ApplyResult> {
  // Claim the event id first — the idempotency guard.
  try {
    await systemDb.processedStripeEvent.create({
      data: { id: `${LEDGER_PREFIX}${input.eventId}`, type: input.type },
    })
  } catch (e) {
    if (isUniqueViolation(e)) return { applied: false, duplicate: true }
    throw e
  }

  const { fields } = input

  // Bind the event to an org: metadata.orgId (set by us at checkout, stable
  // across portal plan changes) is primary; the Stripe customer id is a fallback.
  const org = fields.orgId
    ? await systemDb.organization.findUnique({
        where: { id: fields.orgId },
        select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true },
      })
    : fields.stripeCustomerId
      ? await systemDb.organization.findFirst({
          where: { stripeCustomerId: fields.stripeCustomerId },
          select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true },
        })
      : null

  if (!org) return { applied: false, skipped: "no matching organization" }

  const decision = decideSubscriptionUpdate(org, fields)
  if (decision.action === "skip") return { applied: false, skipped: decision.reason }

  // Build the update: only set tier/interval when the base price was recognized,
  // so an unknown price never silently changes entitlements.
  const data: Record<string, unknown> = {
    stripeSubscriptionId: fields.stripeSubscriptionId,
    subscriptionStatus: fields.subscriptionStatus,
    currentPeriodEnd: fields.currentPeriodEnd,
    cancelAtPeriodEnd: fields.cancelAtPeriodEnd,
    purchasedSeats: fields.purchasedSeats,
  }
  if (fields.stripeCustomerId) data.stripeCustomerId = fields.stripeCustomerId
  if (fields.packageTier) data.packageTier = fields.packageTier as PackageTier
  if (fields.billingInterval) data.billingInterval = fields.billingInterval

  try {
    await systemDb.organization.update({ where: { id: org.id }, data })
    return { applied: true }
  } catch (e) {
    // A unique clash means another org already holds this Stripe customer/
    // subscription id — never overwrite across tenants; record and move on.
    if (isUniqueViolation(e)) {
      return { applied: false, skipped: "stripe id already bound to another organization" }
    }
    throw e
  }
}
