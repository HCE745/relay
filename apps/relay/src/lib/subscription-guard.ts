import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Statuses that should block all writes. We allow:
//   active      — paid subscription
//   trialing    — trial period
//   past_due    — payment failed; Stripe is retrying (grace period)
//   incomplete  — checkout not finalized yet (new signup flow)
//   null/unknown — brand new org, no subscription started
// We block:
//   expired            — trial ended or subscription lapsed
//   read_only          — manually restricted
//   canceled           — subscription canceled
//   incomplete_expired — checkout expired without payment
//   paused             — subscription intentionally paused
const BLOCKED_STATUSES = new Set([
  "expired",
  "read_only",
  "canceled",
  "incomplete_expired",
  "paused",
])

/**
 * Guards a customer-facing write handler. Returns a 402 response when the
 * organization's subscription does not permit mutations; returns null when
 * access is allowed. Always reads from the database (not the JWT) so the
 * check reflects the current billing state rather than a potentially stale
 * token.
 *
 * Usage — place this at the top of any POST/PUT/PATCH/DELETE handler:
 *   const deny = await requireActiveSubscription()
 *   if (deny) return deny
 */
export async function requireActiveSubscription(): Promise<NextResponse | null> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { subscriptionStatus: true },
  })

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  // A null/undefined status means the org hasn't gone through billing yet — allow.
  if (org.subscriptionStatus && BLOCKED_STATUSES.has(org.subscriptionStatus)) {
    return NextResponse.json(
      {
        error: "Your subscription has ended. Please renew your plan to continue using Relay.",
        code:  "SUBSCRIPTION_REQUIRED",
      },
      { status: 402 },
    )
  }

  return null
}
