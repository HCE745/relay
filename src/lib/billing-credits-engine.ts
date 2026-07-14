import "server-only"
import Stripe from "stripe"
import { prisma } from "./prisma"
import { stripe } from "./stripe"
import { logSAAction } from "./sa-audit"
import type {
  CreditType, CreditAppliesTo, CreditStatus,
  CreditSchedulingType, CreditDurationType, BillingCredit,
} from "@/generated/prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCreditInput {
  creditType:                CreditType
  appliesTo:                 CreditAppliesTo
  appliesToDetail?:          string
  discountValue:             number
  description:               string
  internalNotes?:            string
  schedulingType:            CreditSchedulingType
  scheduledStartDate?:       Date
  scheduledStartAfterMonths?: number
  durationType:              CreditDurationType
  durationCycles?:           number
  durationUntilDate?:        Date
  reason?:                   string
}

export interface CreditTimelineItem {
  id:           string
  status:       CreditStatus
  creditType:   CreditType
  appliesTo:    CreditAppliesTo
  discountValue: number
  description:  string
  effectiveDate?: Date | null
  completionDate?: Date | null
  scheduledStartDate?: Date | null
  durationUntilDate?: Date | null
  durationCycles?: number | null
  durationType: CreditDurationType
  stripeCouponId?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStripeCouponParams(credit: BillingCredit): Stripe.CouponCreateParams {
  const base: Stripe.CouponCreateParams = {}

  // Duration
  switch (credit.durationType) {
    case "one_invoice":
      base.duration = "once"
      break
    case "x_billing_cycles":
      base.duration = "repeating"
      base.duration_in_months = credit.durationCycles ?? 1
      break
    case "until_date":
      base.duration = "forever"
      if (credit.durationUntilDate) {
        base.redeem_by = Math.floor(credit.durationUntilDate.getTime() / 1000)
      }
      break
    case "until_cancelled":
      base.duration = "forever"
      break
  }

  // Amount / type
  switch (credit.creditType) {
    case "percentage_off":
      return { ...base, percent_off: credit.discountValue }

    case "fixed_amount":
      return { ...base, amount_off: Math.round(credit.discountValue * 100), currency: "usd" }

    case "free_billing_cycles":
      // Override duration — free cycles = 100% off for N months
      return {
        percent_off: 100,
        duration: "repeating",
        duration_in_months: credit.durationCycles ?? Math.round(credit.discountValue),
      }

    case "free_addon":
    case "free_intelligence_module":
    case "free_employee_band":
    case "free_location":
      // 100% coupon applied at subscription level; appliesToDetail notes which item
      return { ...base, percent_off: 100 }
  }
}

async function applyStripeCredit(
  credit: BillingCredit & { org: { stripeSubscriptionId: string | null } },
): Promise<{ couponId: string | null; discountId: string | null }> {
  if (!stripe || !credit.org.stripeSubscriptionId) return { couponId: null, discountId: null }

  const params = buildStripeCouponParams(credit)
  const coupon = await stripe.coupons.create(params)

  const updated = await stripe.subscriptions.update(credit.org.stripeSubscriptionId, {
    discounts: [{ coupon: coupon.id }],
  })

  const firstDiscount = updated.discounts?.[0]
  const discountId = (firstDiscount && typeof firstDiscount === "object" && "id" in firstDiscount)
    ? (firstDiscount as Stripe.Discount).id
    : null
  return { couponId: coupon.id, discountId }
}

async function removeStripeCredit(credit: BillingCredit & { org: { stripeSubscriptionId: string | null } }) {
  if (!stripe || !credit.org.stripeSubscriptionId) return
  try {
    // Remove all discounts from subscription
    await stripe.subscriptions.update(credit.org.stripeSubscriptionId, { discounts: [] })
  } catch (err) {
    console.error("[billing-credits] Stripe discount removal failed:", err)
  }
}

// ─── Core engine functions ────────────────────────────────────────────────────

export async function createCredit(
  orgId: string,
  input: CreateCreditInput,
  createdBySuperAdminId: string,
  auditCtx?: { superAdminId: string; superAdminName: string; orgName: string },
): Promise<BillingCredit> {
  // Determine initial status
  let initialStatus: CreditStatus = "pending"
  if (input.schedulingType === "immediate") {
    initialStatus = "active"
  } else if (input.schedulingType === "specific_date") {
    initialStatus = input.scheduledStartDate && input.scheduledStartDate <= new Date()
      ? "active"
      : "scheduled"
  } else {
    // after_months_active / after_referral_qualification / after_trial_conversion
    initialStatus = "pending"
  }

  const credit = await prisma.billingCredit.create({
    data: {
      orgId,
      creditType:                input.creditType,
      appliesTo:                 input.appliesTo,
      appliesToDetail:           input.appliesToDetail ?? null,
      discountValue:             input.discountValue,
      description:               input.description,
      internalNotes:             input.internalNotes ?? null,
      status:                    initialStatus,
      schedulingType:            input.schedulingType,
      scheduledStartDate:        input.scheduledStartDate ?? null,
      scheduledStartAfterMonths: input.scheduledStartAfterMonths ?? null,
      durationType:              input.durationType,
      durationCycles:            input.durationCycles ?? null,
      durationUntilDate:         input.durationUntilDate ?? null,
      reason:                    input.reason ?? null,
      createdBySuperAdminId,
    },
  })

  if (auditCtx) {
    await logSAAction({
      superAdminId:   auditCtx.superAdminId,
      superAdminName: auditCtx.superAdminName,
      action:     "CREATE_BILLING_CREDIT",
      orgId,
      orgName:    auditCtx.orgName,
      targetType: "organization",
      targetId:   credit.id,
      targetName: input.description,
      after: {
        creditId: credit.id, creditType: input.creditType,
        status: initialStatus, discountValue: input.discountValue,
        schedulingType: input.schedulingType,
      },
    })
  }

  // If status resolved to active, apply Stripe immediately
  if (initialStatus === "active") {
    await activateCredit(credit.id, auditCtx)
  }

  return credit
}

export async function activateCredit(
  creditId: string,
  auditCtx?: { superAdminId: string; superAdminName: string; orgName: string },
): Promise<{ ok: boolean; error?: string }> {
  const credit = await prisma.billingCredit.findUnique({
    where: { id: creditId },
    include: { org: { select: { id: true, name: true, stripeSubscriptionId: true } } },
  })
  if (!credit) return { ok: false, error: "Credit not found" }
  if (credit.status === "active") return { ok: true }

  let couponId: string | null = null
  let discountId: string | null = null

  try {
    const result = await applyStripeCredit(credit as BillingCredit & { org: { stripeSubscriptionId: string | null } })
    couponId = result.couponId
    discountId = result.discountId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[billing-credits] activateCredit Stripe error:", msg)
    // Still mark active in our DB — Stripe can be retried
  }

  await prisma.billingCredit.update({
    where: { id: creditId },
    data: {
      status:          "active",
      effectiveDate:   new Date(),
      stripeCouponId:  couponId,
      stripeDiscountId: discountId,
    },
  })

  if (auditCtx) {
    await logSAAction({
      superAdminId:   auditCtx.superAdminId,
      superAdminName: auditCtx.superAdminName,
      action:     "ACTIVATE_BILLING_CREDIT",
      orgId:      credit.orgId,
      orgName:    auditCtx.orgName,
      targetType: "organization",
      targetId:   creditId,
      targetName: credit.description,
      after: { status: "active", stripeCouponId: couponId, stripeDiscountId: discountId },
    })
  }

  return { ok: true }
}

export async function completeCredit(
  creditId: string,
  auditCtx?: { superAdminId: string; superAdminName: string; orgName: string },
): Promise<void> {
  const credit = await prisma.billingCredit.findUnique({
    where: { id: creditId },
    include: { org: { select: { stripeSubscriptionId: true } } },
  })
  if (!credit || credit.status !== "active") return

  await removeStripeCredit(credit as BillingCredit & { org: { stripeSubscriptionId: string | null } })

  await prisma.billingCredit.update({
    where: { id: creditId },
    data: { status: "completed", completionDate: new Date() },
  })

  if (auditCtx) {
    await logSAAction({
      superAdminId:   auditCtx.superAdminId,
      superAdminName: auditCtx.superAdminName,
      action:     "COMPLETE_BILLING_CREDIT",
      orgId:      credit.orgId,
      orgName:    auditCtx.orgName,
      targetType: "organization",
      targetId:   creditId,
      targetName: credit.description,
      before: { status: "active" },
      after:  { status: "completed" },
    })
  }
}

export async function cancelCredit(
  creditId: string,
  reason: string,
  auditCtx?: { superAdminId: string; superAdminName: string; orgName: string },
): Promise<{ ok: boolean; error?: string }> {
  const credit = await prisma.billingCredit.findUnique({
    where: { id: creditId },
    include: { org: { select: { id: true, name: true, stripeSubscriptionId: true } } },
  })
  if (!credit) return { ok: false, error: "Credit not found" }
  if (credit.status === "cancelled" || credit.status === "completed") {
    return { ok: false, error: `Credit is already ${credit.status}` }
  }

  if (credit.status === "active") {
    await removeStripeCredit(credit as BillingCredit & { org: { stripeSubscriptionId: string | null } })
  }

  await prisma.billingCredit.update({
    where: { id: creditId },
    data: { status: "cancelled", completionDate: new Date(), reason },
  })

  if (auditCtx) {
    await logSAAction({
      superAdminId:   auditCtx.superAdminId,
      superAdminName: auditCtx.superAdminName,
      action:     "CANCEL_BILLING_CREDIT",
      orgId:      credit.orgId,
      orgName:    auditCtx.orgName,
      targetType: "organization",
      targetId:   creditId,
      targetName: credit.description,
      before: { status: credit.status },
      after:  { status: "cancelled", reason },
    })
  }

  return { ok: true }
}

export async function getOrgCreditTimeline(orgId: string): Promise<CreditTimelineItem[]> {
  const credits = await prisma.billingCredit.findMany({
    where: { orgId },
    orderBy: [
      { effectiveDate: "asc" },
      { scheduledStartDate: "asc" },
      { createdAt: "asc" },
    ],
  })

  return credits.map(c => ({
    id:                c.id,
    status:            c.status,
    creditType:        c.creditType,
    appliesTo:         c.appliesTo,
    discountValue:     c.discountValue,
    description:       c.description,
    effectiveDate:     c.effectiveDate,
    completionDate:    c.completionDate,
    scheduledStartDate: c.scheduledStartDate,
    durationUntilDate: c.durationUntilDate,
    durationCycles:    c.durationCycles,
    durationType:      c.durationType,
    stripeCouponId:    c.stripeCouponId,
  }))
}

export function calculateEffectiveMonthly(
  baseMonthly: number,
  activeCredits: Pick<BillingCredit, "creditType" | "discountValue" | "appliesTo">[],
): number {
  let total = baseMonthly
  for (const credit of activeCredits) {
    if (credit.creditType === "percentage_off") {
      total = total * (1 - credit.discountValue / 100)
    } else if (credit.creditType === "fixed_amount") {
      total = Math.max(0, total - credit.discountValue)
    }
    // free_billing_cycles / free_addon etc. are handled by Stripe, not reflected in this calc
  }
  return Math.max(0, total)
}

// ─── Cron worker ─────────────────────────────────────────────────────────────

export interface CronResult {
  activated:  string[]
  completed:  string[]
  expired:    string[]
  errors:     { creditId: string; error: string }[]
}

export async function checkAndActivateScheduledCredits(): Promise<CronResult> {
  const now = new Date()
  const result: CronResult = { activated: [], completed: [], expired: [], errors: [] }

  // Get first super admin for system-triggered audits
  const systemSA = await prisma.superAdmin.findFirst({ select: { id: true, name: true } })
  const sysCtx = systemSA
    ? { superAdminId: systemSA.id, superAdminName: systemSA.name + " (cron)", orgName: "" }
    : undefined

  // 1. Activate scheduled credits whose date has arrived
  const scheduled = await prisma.billingCredit.findMany({
    where: {
      status: { in: ["scheduled", "pending"] },
      schedulingType: { in: ["specific_date", "after_months_active", "after_trial_conversion"] },
    },
    include: { org: { select: { id: true, name: true, createdAt: true, subscriptionStatus: true, stripeSubscriptionId: true } } },
  })

  for (const credit of scheduled) {
    try {
      let shouldActivate = false

      if (credit.schedulingType === "specific_date") {
        shouldActivate = !!(credit.scheduledStartDate && credit.scheduledStartDate <= now)
      } else if (credit.schedulingType === "after_months_active") {
        const monthsRequired = credit.scheduledStartAfterMonths ?? 0
        const monthsOld = (now.getTime() - credit.org.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        shouldActivate = monthsOld >= monthsRequired
      } else if (credit.schedulingType === "after_trial_conversion") {
        shouldActivate = credit.org.subscriptionStatus === "active"
      }

      if (shouldActivate) {
        const ctx = sysCtx ? { ...sysCtx, orgName: credit.org.name } : undefined
        await activateCredit(credit.id, ctx)
        result.activated.push(credit.id)
      }
    } catch (err) {
      result.errors.push({ creditId: credit.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 2. Complete credits that have expired by duration or until_date
  const activeCredits = await prisma.billingCredit.findMany({
    where: { status: "active" },
    include: { org: { select: { id: true, name: true, stripeSubscriptionId: true } } },
  })

  for (const credit of activeCredits) {
    try {
      let shouldComplete = false
      let shouldExpire = false

      if (credit.durationType === "until_date" && credit.durationUntilDate && credit.durationUntilDate <= now) {
        shouldExpire = true
      } else if (credit.durationType === "x_billing_cycles" && credit.effectiveDate && credit.durationCycles) {
        const cycleMs = credit.durationCycles * 30.44 * 24 * 60 * 60 * 1000
        if (credit.effectiveDate.getTime() + cycleMs <= now.getTime()) {
          shouldComplete = true
        }
      }

      if (shouldExpire || shouldComplete) {
        await removeStripeCredit(credit as BillingCredit & { org: { stripeSubscriptionId: string | null } })
        const newStatus = shouldExpire ? "expired" : "completed"
        await prisma.billingCredit.update({
          where: { id: credit.id },
          data: { status: newStatus, completionDate: now },
        })
        if (shouldExpire) result.expired.push(credit.id)
        else result.completed.push(credit.id)
      }
    } catch (err) {
      result.errors.push({ creditId: credit.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return result
}

// ─── Referral reward helpers ───────────────────────────────────────────────────

export async function getActiveReferralProgram() {
  return prisma.referralProgram.findFirst({ where: { isActive: true } })
}

export async function triggerReferralReward(
  referralId: string,
  createdBySuperAdminId: string,
): Promise<{ ok: boolean; referrerCreditId?: string; referredCreditId?: string; error?: string }> {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      referrerOrg: { select: { id: true, name: true } },
      referredOrg: { select: { id: true, name: true } },
      program:     true,
    },
  })
  if (!referral) return { ok: false, error: "Referral not found" }
  if (referral.rewardStatus === "rewarded") return { ok: false, error: "Already rewarded" }

  // Resolve reward config: referral's program > active program > hardcoded defaults
  const prog = referral.program ?? await getActiveReferralProgram()

  const referrerInput: CreateCreditInput = {
    creditType:     (prog?.referrerRewardType   ?? "free_billing_cycles") as CreditType,
    appliesTo:      (prog?.referrerRewardAppliesTo ?? "entire_invoice") as CreditAppliesTo,
    discountValue:  prog?.referrerRewardValue   ?? 1,
    durationCycles: prog?.referrerRewardCycles  ?? 1,
    durationType:   "one_invoice",
    schedulingType: (prog?.referrerSchedulingType ?? "immediate") as CreditSchedulingType,
    description:    `Referral reward — ${describeCreditType(
      (prog?.referrerRewardType ?? "free_billing_cycles") as CreditType,
      prog?.referrerRewardValue ?? 1,
    )}`,
    reason: "Referral qualification reward",
  }

  const referredInput: CreateCreditInput = {
    creditType:     (prog?.referredRewardType   ?? "free_billing_cycles") as CreditType,
    appliesTo:      (prog?.referredRewardAppliesTo ?? "entire_invoice") as CreditAppliesTo,
    discountValue:  prog?.referredRewardValue   ?? 1,
    durationCycles: prog?.referredRewardCycles  ?? 1,
    durationType:   "one_invoice",
    schedulingType: (prog?.referredSchedulingType ?? "immediate") as CreditSchedulingType,
    description:    `Welcome referral reward — ${describeCreditType(
      (prog?.referredRewardType ?? "free_billing_cycles") as CreditType,
      prog?.referredRewardValue ?? 1,
    )}`,
    reason: "Referral qualification reward (referred customer)",
  }

  const referrerCredit = await createCredit(
    referral.referrerOrgId, referrerInput, createdBySuperAdminId,
    { superAdminId: createdBySuperAdminId, superAdminName: "System (referral cron)", orgName: referral.referrerOrg.name },
  )
  const referredCredit = await createCredit(
    referral.referredOrgId, referredInput, createdBySuperAdminId,
    { superAdminId: createdBySuperAdminId, superAdminName: "System (referral cron)", orgName: referral.referredOrg.name },
  )

  await prisma.referral.update({
    where: { id: referralId },
    data: {
      rewardStatus:     "rewarded",
      rewardDate:       new Date(),
      qualifiedAt:      referral.qualifiedAt ?? new Date(),
      referrerCreditId: referrerCredit.id,
      referredCreditId: referredCredit.id,
    },
  })

  return { ok: true, referrerCreditId: referrerCredit.id, referredCreditId: referredCredit.id }
}

// ─── Referral code generation ─────────────────────────────────────────────────

export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function generateUniqueReferralCode(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  let attempts = 0
  while (attempts < 20) {
    const code = generateReferralCode()
    const existing = await prisma.organization.findUnique({ where: { referralCode: code }, select: { id: true } })
    if (!existing) return code
    attempts++
  }
  // Fallback: use timestamp suffix to guarantee uniqueness
  return generateReferralCode() + Date.now().toString(36).slice(-2).toUpperCase()
}

export function buildReferralLink(code: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  return `${appUrl}/signup?ref=${code}`
}

// ─── Human-readable helpers ───────────────────────────────────────────────────

export function describeCreditType(type: CreditType, value: number): string {
  switch (type) {
    case "percentage_off":           return `${value}% off`
    case "fixed_amount":             return `$${value}/mo off`
    case "free_billing_cycles":      return `${value} free billing cycle${value !== 1 ? "s" : ""}`
    case "free_addon":               return "Free add-on"
    case "free_intelligence_module": return "Free intelligence module"
    case "free_employee_band":       return "Free employee tier"
    case "free_location":            return "Free location"
  }
}

export function describeDuration(type: CreditDurationType, cycles?: number | null, until?: Date | null): string {
  switch (type) {
    case "one_invoice":      return "One invoice"
    case "x_billing_cycles": return `${cycles ?? "?"} billing cycle${(cycles ?? 0) !== 1 ? "s" : ""}`
    case "until_date":       return until ? `Until ${until.toLocaleDateString()}` : "Until date"
    case "until_cancelled":  return "Until cancelled"
  }
}
