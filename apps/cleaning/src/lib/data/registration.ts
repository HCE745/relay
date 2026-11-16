import bcrypt from "bcryptjs"
import crypto from "crypto"
import { systemDb } from "../org-db"
import { ConflictError } from "./errors"
import { buildOrgSlug, TRIAL_TIER } from "../registration"
import { TRIAL_DAYS } from "../subscription/plans"

// Self-service trial provisioning (Phase E). Creates an organization on a 14-day
// no-card trial plus its INACTIVE owner and a verification token, atomically. The
// owner cannot sign in until the emailed link activates them (see
// data/email-verification). No Stripe customer/subscription is created — a card
// is only added later via the upgrade flow.

export type TrialRegistrationInput = {
  orgName: string
  name: string
  email: string
  password: string
  timezone: string
}

/**
 * Provision a trial org + inactive owner + verification token in one transaction.
 * Returns the raw verification token (for the emailed link). Throws ConflictError
 * if the email is already in use. The org starts subscriptionStatus="trialing"
 * with trialEndsAt = now + TRIAL_DAYS, which subscriptionAccess() honors once
 * enforcement is enabled; onboarding is NOT marked complete, so the owner lands
 * in setup after verifying.
 */
export async function registerTrialCompany(
  input: TrialRegistrationInput,
): Promise<{ token: string; email: string; name: string }> {
  const email = input.email.trim().toLowerCase()
  const existing = await systemDb.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw new ConflictError("That email is already in use.")

  const slug = buildOrgSlug(input.orgName, crypto.randomBytes(3).toString("hex"))
  const password = await bcrypt.hash(input.password, 10)
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  await systemDb.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.orgName,
        slug,
        packageTier: TRIAL_TIER,
        subscriptionStatus: "trialing",
        trialEndsAt,
        timezone: input.timezone,
      },
      select: { id: true },
    })
    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        name: input.name,
        email,
        password,
        role: "OWNER",
        isActive: false, // activated by email verification
      },
      select: { id: true },
    })
    await tx.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })
  })

  return { token, email, name: input.name }
}
