import { systemDb, isUniqueViolation } from "../org-db"
import { fetchSubscription } from "../subscription/stripe-subscriptions"
import {
  buildPriceLookup,
  decideSubscriptionUpdate,
  subscriptionToOrgFields,
  type OrgSubscriptionFields,
  type StripeSubscription,
} from "../subscription/sync"
import type { PackageTier } from "../entitlements/packages"

// SaaS subscription sync (Phase 50 / Phases C–D). Platform-level writes keyed off
// the SEPARATE CleanWare billing Stripe account. Stripe is the source of truth:
// the webhook re-fetches the live subscription, maps it with subscription/sync.ts,
// and hands the fields here to persist onto the Organization.
//
// This is NOT the customer-invoice payment path (src/lib/data/payments.ts) — it
// never touches invoices. Idempotency reuses the ProcessedStripeEvent ledger,
// but under a "billing:" id prefix so a subscription event can never be confused
// with an invoice event from the other Stripe account.

const LEDGER_PREFIX = "billing:"

const ORG_SELECT = { id: true, stripeSubscriptionId: true, subscriptionStatus: true } as const

export type ApplyResult =
  | { applied: true }
  | { applied: false; duplicate?: true; skipped?: string }

/** Build the Organization update payload from mapped fields. Tier/interval are
 *  only set when the base price was recognized, so an unknown price never
 *  silently changes entitlements. */
function buildOrgData(fields: OrgSubscriptionFields): Record<string, unknown> {
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
  return data
}

/**
 * Apply an authoritative subscription state to its Organization, exactly once.
 *
 * Transactional + retryable: the org update and the idempotency claim commit in
 * ONE transaction, and the claim is written LAST. So a transient failure (DB /
 * Stripe fetch upstream) aborts before the event is consumed — nothing commits,
 * the route returns 500, and Stripe's retry reprocesses cleanly. A genuine
 * duplicate hits the ledger PK and rolls the whole thing back (the first
 * processing already applied). Enforces the one-live-subscription-per-org
 * duplicate guard and never overwrites a Stripe id across tenants.
 */
export async function applySubscriptionEvent(input: {
  eventId: string
  type: string
  fields: OrgSubscriptionFields
}): Promise<ApplyResult> {
  const ledgerId = `${LEDGER_PREFIX}${input.eventId}`
  const { fields } = input
  try {
    return await systemDb.$transaction(async (tx) => {
      // Bind the event to an org: metadata.orgId (set by us at checkout, stable
      // across portal plan changes) is primary; the Stripe customer id is a
      // fallback. Neither is attacker-controllable — the payload is Stripe-signed
      // and both ids are ours.
      const org = fields.orgId
        ? await tx.organization.findUnique({ where: { id: fields.orgId }, select: ORG_SELECT })
        : fields.stripeCustomerId
          ? await tx.organization.findFirst({ where: { stripeCustomerId: fields.stripeCustomerId }, select: ORG_SELECT })
          : null

      let result: ApplyResult
      if (!org) {
        result = { applied: false, skipped: "no matching organization" }
      } else {
        const decision = decideSubscriptionUpdate(org, fields)
        if (decision.action === "skip") {
          result = { applied: false, skipped: decision.reason }
        } else {
          await tx.organization.update({ where: { id: org.id }, data: buildOrgData(fields) })
          result = { applied: true }
        }
      }

      // Consume the event LAST (see the transactional note above).
      await tx.processedStripeEvent.create({ data: { id: ledgerId, type: input.type } })
      return result
    })
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Either the event's ledger PK (already processed) or a cross-tenant
      // stripe-id clash on the org update. Both are terminal — never retry.
      const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "")
      if (/stripe/i.test(target)) {
        return { applied: false, skipped: "stripe id already bound to another organization" }
      }
      return { applied: false, duplicate: true }
    }
    throw e // transient → caller returns 500 → Stripe retries (nothing committed)
  }
}

/**
 * Reconcile one org against Stripe's live subscription state — the recovery path
 * for a webhook that was never delivered (endpoint down past Stripe's retry
 * window). Re-fetches the authoritative subscription and re-applies it. No ledger
 * entry: reconciliation is inherently idempotent because it writes current truth.
 * Intended for an admin "re-sync" action or a periodic sweep; it is NOT part of
 * live request handling and does not enable enforcement.
 */
export async function reconcileSubscriptionFromStripe(
  orgId: string,
): Promise<{ reconciled: boolean; reason?: string }> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: ORG_SELECT })
  if (!org?.stripeSubscriptionId) return { reconciled: false, reason: "no subscription on file" }

  const sub = (await fetchSubscription(org.stripeSubscriptionId)) as StripeSubscription
  const fields = subscriptionToOrgFields(sub, buildPriceLookup())
  const decision = decideSubscriptionUpdate(org, fields)
  if (decision.action === "skip") return { reconciled: false, reason: decision.reason }

  await systemDb.organization.update({ where: { id: org.id }, data: buildOrgData(fields) })
  return { reconciled: true }
}
