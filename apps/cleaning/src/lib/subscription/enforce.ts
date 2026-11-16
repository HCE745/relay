import "server-only"
import { prisma } from "../prisma"
import { paymentRequired } from "../api"
import { canManageOrg } from "../rbac"
import {
  isSubscriptionEnforcementEnabled,
  subscriptionGuardOutcome,
  type OrgAccessInput,
} from "./access"

// Server-side subscription enforcement for the shared guards (src/lib/guards.ts).
// This is the single choke-point where lapsed orgs are blocked, so enforcement
// holds across every API route and server action that goes through a guard —
// not just the UI. While CLEANING_SUBSCRIPTION_ENFORCEMENT is unset the whole
// thing is a no-op, so it ships dark until explicitly switched on.

const ORG_ACCESS_SELECT = {
  isDemo: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  stripeSubscriptionId: true,
  currentPeriodEnd: true,
} as const

/** Authoritative org access state, read fresh from the DB (never the JWT). */
async function loadOrgAccess(orgId: string): Promise<OrgAccessInput | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: ORG_ACCESS_SELECT })
  if (!org) return null
  return {
    isDemo: org.isDemo,
    subscriptionStatus: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    stripeSubscriptionId: org.stripeSubscriptionId,
    currentPeriodEnd: org.currentPeriodEnd,
  }
}

/**
 * If the org may not use operational functions, return a ready 402 Response;
 * otherwise null (allowed). `isDemo`/paid/trial are all decided from the DB, so
 * demo status cannot be forged via the session to bypass billing. On recovery
 * routes an administrator is always let through so billing/payment-method/export
 * stay reachable while lapsed.
 */
export async function subscriptionBlock(
  session: { organizationId: string; role: string },
  opts: { recovery?: boolean } = {},
): Promise<Response | null> {
  if (!isSubscriptionEnforcementEnabled()) return null
  const org = await loadOrgAccess(session.organizationId)
  const outcome = subscriptionGuardOutcome({
    enforcementEnabled: true,
    org,
    now: new Date(),
    recovery: opts.recovery ?? false,
    actorIsAdmin: canManageOrg(session.role),
  })
  return outcome.block ? paymentRequired() : null
}
