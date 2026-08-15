import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { buildLineItems, getPriceId } from "@/lib/stripe-prices"
import { logSAAction } from "@/lib/sa-audit"
import { setWorkforceCommsPlanFlags } from "@/lib/workforce-comms"
import type Stripe from "stripe"
import type { PlanKey, ModuleId } from "@/lib/pricing"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as {
    plan?: string
    productLine?: string
    employeeCount?: number
    locationCount?: number
    intelligenceModules?: string[]
    intelligenceSuiteEnabled?: boolean
    discountPercent?: number | null
    discountExpiresAt?: string | null
    discountLabel?: string | null
    billingFrequency?: string
    currentPrice?: number | null
    priceLockedUntil?: string | null
  }

  const before: Record<string, unknown> = {
    plan: org.plan,
    subscriptionStatus: org.subscriptionStatus,
    billingFrequency: org.billingFrequency,
    intelligenceModules: org.intelligenceModules,
    intelligenceSuiteEnabled: org.intelligenceSuiteEnabled,
    discountPercent: org.discountPercent ?? null,
    discountExpiresAt: org.discountExpiresAt?.toISOString() ?? null,
    monthlyTotalAfterDiscount: org.monthlyTotalAfterDiscount ?? null,
  }

  const rawPlan = body.plan ?? org.plan
  const newPlan = rawPlan as PlanKey
  const newModules = (body.intelligenceModules ?? (org.intelligenceModules as string[])) as ModuleId[]
  const newSuite = body.intelligenceSuiteEnabled ?? org.intelligenceSuiteEnabled ?? false
  const newDiscountPct = "discountPercent" in body ? (body.discountPercent ?? null) : (org.discountPercent ?? null)
  const newDiscountExpires = "discountExpiresAt" in body ? (body.discountExpiresAt ?? null) : (org.discountExpiresAt?.toISOString() ?? null)
  const newDiscountLabel = "discountLabel" in body ? (body.discountLabel ?? null) : (org.discountLabel ?? null)

  const stripeActions: string[] = []

  // Make Stripe calls for non-enterprise plans that have a subscription ID
  const isStripePlan = rawPlan !== "enterprise" && !["custom", "free", "starter"].includes(rawPlan)
  if (isStripePlan && org.stripeSubscriptionId && stripe) {
    try {
      const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
        expand: ["items.data.price"],
      })

      const employeeCount = body.employeeCount ?? (org.employeeLimit ?? 50)
      const locationCount = body.locationCount ?? (org.locationLimit ?? 1)

      const desiredItems = buildLineItems({
        plan: newPlan,
        employeeCount,
        locationCount,
        selectedModuleIds: newModules,
        intelligenceSuite: newSuite,
      })

      // Existing items indexed by price ID
      const existingByPriceId = new Map<string, { itemId: string; quantity: number }>()
      for (const item of subscription.items.data) {
        existingByPriceId.set(item.price.id, {
          itemId: item.id,
          quantity: item.quantity ?? 1,
        })
      }

      // Desired items indexed by price ID
      const desiredByPriceId = new Map<string, number>()
      for (const di of desiredItems) {
        desiredByPriceId.set(di.price, di.quantity)
      }

      const updateItems: object[] = []

      // Items to remove (in existing but not in desired)
      for (const [priceId, existing] of existingByPriceId) {
        if (!desiredByPriceId.has(priceId)) {
          updateItems.push({ id: existing.itemId, deleted: true })
        }
      }

      // Items to add or update quantity
      for (const [priceId, quantity] of desiredByPriceId) {
        const existing = existingByPriceId.get(priceId)
        if (existing) {
          if (existing.quantity !== quantity) {
            updateItems.push({ id: existing.itemId, quantity })
          }
        } else {
          updateItems.push({ price: priceId, quantity })
        }
      }

      if (updateItems.length > 0) {
        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          items: updateItems as Stripe.SubscriptionUpdateParams.Item[],
          proration_behavior: "create_prorations",
        })
        stripeActions.push(`Updated ${updateItems.length} subscription line item(s)`)
      }

      // Handle founding discount coupon
      const existingCouponId = org.stripeCouponId ?? null

      if (newDiscountPct && newDiscountPct > 0) {
        // Delete old coupon if it exists (coupons are immutable so we recreate)
        if (existingCouponId) {
          try {
            await stripe.subscriptions.deleteDiscount(org.stripeSubscriptionId)
          } catch {}
          try { await stripe.coupons.del(existingCouponId) } catch {}
        }

        let durationMonths: number | undefined
        if (newDiscountExpires) {
          const expiresMs = new Date(newDiscountExpires).getTime() - Date.now()
          const months = Math.max(1, Math.ceil(expiresMs / (1000 * 60 * 60 * 24 * 30.5)))
          durationMonths = months
        }

        const coupon = await stripe.coupons.create({
          percent_off: newDiscountPct,
          duration: durationMonths ? "repeating" : "forever",
          ...(durationMonths ? { duration_in_months: durationMonths } : {}),
          name: newDiscountLabel ?? "Founding Customer Discount",
        })

        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          discounts: [{ coupon: coupon.id }],
        })

        // Persist the new coupon ID
        await prisma.organization.update({
          where: { id },
          data: { stripeCouponId: coupon.id },
        })

        stripeActions.push(`Applied ${newDiscountPct}% founding discount coupon (${coupon.id})`)
      } else if (existingCouponId) {
        // Remove discount from subscription
        await stripe.subscriptions.deleteDiscount(org.stripeSubscriptionId)
        try { await stripe.coupons.del(existingCouponId) } catch {}
        await prisma.organization.update({
          where: { id },
          data: { stripeCouponId: null },
        })
        stripeActions.push("Removed founding discount coupon")
      }
    } catch (err) {
      console.error("[Subscription] Stripe error:", err)
      return NextResponse.json(
        { error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }
  }

  // Build DB update
  const dbData: Record<string, unknown> = {}
  if (body.plan !== undefined) {
    dbData.plan = body.plan
    dbData.productLine = body.productLine ?? (body.plan === "wash_essentials" ? "WASH_ESSENTIALS" : "RELAY_STANDARD")
  }
  if (body.billingFrequency !== undefined) dbData.billingFrequency = body.billingFrequency
  if ("currentPrice" in body) dbData.currentPrice = body.currentPrice ?? null
  if ("priceLockedUntil" in body) {
    dbData.priceLockedUntil = body.priceLockedUntil ? new Date(body.priceLockedUntil) : null
  }
  if (body.intelligenceModules !== undefined) dbData.intelligenceModules = body.intelligenceModules
  if (body.intelligenceSuiteEnabled !== undefined) dbData.intelligenceSuiteEnabled = body.intelligenceSuiteEnabled
  if ("discountPercent" in body) dbData.discountPercent = body.discountPercent ?? null
  if ("discountExpiresAt" in body) {
    dbData.discountExpiresAt = body.discountExpiresAt ? new Date(body.discountExpiresAt) : null
  }
  if ("discountLabel" in body) dbData.discountLabel = body.discountLabel ?? null
  if (body.employeeCount !== undefined) dbData.employeeLimit = body.employeeCount
  if (body.locationCount !== undefined) dbData.locationLimit = body.locationCount

  if (Object.keys(dbData).length === 0 && stripeActions.length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 })
  }

  const updatedOrg = await prisma.organization.update({ where: { id }, data: dbData })

  if (body.plan !== undefined) {
    await setWorkforceCommsPlanFlags(id, body.plan)
  }

  const after: Record<string, unknown> = {
    plan: updatedOrg.plan,
    billingFrequency: updatedOrg.billingFrequency,
    intelligenceModules: updatedOrg.intelligenceModules,
    intelligenceSuiteEnabled: updatedOrg.intelligenceSuiteEnabled,
    discountPercent: updatedOrg.discountPercent ?? null,
    discountExpiresAt: updatedOrg.discountExpiresAt?.toISOString() ?? null,
    monthlyTotalAfterDiscount: updatedOrg.monthlyTotalAfterDiscount ?? null,
    stripeActions,
  }

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action:         "UPDATE_PRICING",
    orgId:          org.id,
    orgName:        org.name,
    targetType:     "organization",
    targetId:       org.id,
    targetName:     org.name,
    before,
    after,
  })

  return NextResponse.json({ success: true, stripeActions })
}
