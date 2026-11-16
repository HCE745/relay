import { prisma } from "../prisma"
import { ConflictError } from "./errors"
import { isSubscriptionEnforcementEnabled, seatActivationOutcome } from "../subscription/access"

// Staff-seat enforcement. A "seat" is an ACTIVE, non-CLIENT user: portal/CLIENT
// users and deactivated users never count. The ceiling comes from the org's plan
// plus Stripe-purchased extra seats (synced onto Organization.purchasedSeats by
// the billing webhook), so additional seats are validated against real billing,
// never a client claim. A no-op while enforcement is off; demo orgs are exempt.

/** Count the org's active staff seats (active users whose role is not CLIENT). */
export function countActiveSeats(orgId: string): Promise<number> {
  return prisma.user.count({ where: { organizationId: orgId, isActive: true, role: { not: "CLIENT" } } })
}

/**
 * Throw a ConflictError (→ 409) if the org cannot take one more active staff
 * seat. Call this immediately BEFORE any operation that would create, activate,
 * reactivate, or promote a user into an active non-CLIENT seat. When the new user
 * would be a CLIENT (portal) or stay inactive, do not call it — those never
 * consume a seat.
 */
export async function assertSeatAvailable(orgId: string): Promise<void> {
  if (!isSubscriptionEnforcementEnabled()) return
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isDemo: true, packageTier: true, purchasedSeats: true },
  })
  // Fail closed: if the org's plan cannot be resolved while enforcement is on, do
  // not let an unverifiable seat be added. (A transient read throws instead of
  // returning null, so this does not punish infra blips.)
  if (!org) throw new ConflictError("Unable to verify your plan's seat limit right now. Please try again.")
  const current = await countActiveSeats(orgId)
  const outcome = seatActivationOutcome({
    enforcementEnabled: true,
    isDemo: org.isDemo,
    tier: org.packageTier,
    purchasedSeats: org.purchasedSeats,
    currentActiveNonClientCount: current,
  })
  if (outcome.block) {
    throw new ConflictError(
      `Seat limit reached (${outcome.limit} active team ${outcome.limit === 1 ? "member" : "members"}). ` +
        `Upgrade your plan or add seats to activate another team member.`,
    )
  }
}
