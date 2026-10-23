import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { calculatePrice, type PlanKey, type ModuleId } from "@/lib/pricing"
import { buildLineItems } from "@/lib/stripe-prices"
import * as Sentry from "@sentry/nextjs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) {
    return NextResponse.json({ error: "Payment service not configured" }, { status: 503 })
  }

  const body = await req.json() as {
    plan:               PlanKey
    locationCount:      number
    // Employee-count and module fields are not used by Wash Essentials but are
    // required for standard Relay plans — default to zero/empty when omitted.
    employeeCount?:     number
    selectedModuleIds?: ModuleId[]
    intelligenceSuite?: boolean
  }

  const employeeCount     = body.employeeCount     ?? 0
  const selectedModuleIds = body.selectedModuleIds ?? []
  // Professional Plus always gets the Intelligence Suite
  const intelligenceSuite = body.plan === "professional_plus"
    ? true
    : (body.intelligenceSuite ?? false)

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      id:                true,
      name:              true,
      industry:          true,
      productLine:       true,
      discountPercent:   true,
      discountExpiresAt: true,
      stripeCustomerId:  true,
      stripeCouponId:    true,
      pendingOfferToken: true,
    },
  })

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  // Server-side product validation: Wash Essentials is exclusively for Car Wash orgs.
  // ?industry=car_wash on the subscribe page is a UI hint only — the server is authoritative.
  if (body.plan === "wash_essentials" && org.industry !== "Car Wash") {
    return NextResponse.json(
      { error: "Wash Essentials is only available for Car Wash operations." },
      { status: 400 },
    )
  }

  // Derive the productLine that matches the chosen plan.
  // Non-Wash-Essentials plans always produce RELAY_STANDARD so an upgrade
  // from Wash Essentials is handled correctly here without a separate route.
  const newProductLine =
    body.plan === "wash_essentials" ? "WASH_ESSENTIALS" : "RELAY_STANDARD"

  try {
    // Create or reuse Stripe customer
    let customerId = org.stripeCustomerId
    if (!customerId) {
      const adminUser = await prisma.user.findFirst({
        where: { organizationId: org.id, role: "ADMIN", isActive: true },
        select: { name: true, email: true },
      })
      const customer = await stripe.customers.create({
        name:     org.name,
        email:    adminUser?.email ?? undefined,
        metadata: { organizationId: org.id },
      })
      customerId = customer.id
      await prisma.organization.update({
        where: { id: org.id },
        data:  { stripeCustomerId: customerId },
      })
    }

    // Resolve pending sales offer
    let pendingOffer: {
      id: string
      token: string
      offerType: string
      discountPercent: number | null
      flatMonthlyPrice: number | null
      freeMonths: number | null
      durationMonths: number | null
    } | null = null
    if (org.pendingOfferToken) {
      const found = await prisma.salesOffer.findUnique({
        where: { token: org.pendingOfferToken },
        select: {
          id: true, token: true, offerType: true,
          discountPercent: true, flatMonthlyPrice: true,
          freeMonths: true, durationMonths: true,
          maxRedemptions: true, redemptionCount: true,
          expiresAt: true, redeemedAt: true,
        },
      })
      if (
        found &&
        !found.redeemedAt &&
        found.redemptionCount < found.maxRedemptions &&
        (!found.expiresAt || found.expiresAt > new Date())
      ) {
        pendingOffer = {
          id:               found.id,
          token:            found.token,
          offerType:        found.offerType,
          discountPercent:  found.discountPercent ? Number(found.discountPercent) : null,
          flatMonthlyPrice: found.flatMonthlyPrice ? Number(found.flatMonthlyPrice) : null,
          freeMonths:       found.freeMonths,
          durationMonths:   found.durationMonths,
        }
      }
    }

    // Create or reuse coupon — offer takes priority over founding-customer discount
    let couponId: string | undefined

    if (pendingOffer) {
      // Sales offer pricing — create a one-time coupon or custom price
      if (pendingOffer.offerType === "PERCENT_DISCOUNT" && pendingOffer.discountPercent) {
        const months = pendingOffer.durationMonths ?? 12
        const coupon = await stripe.coupons.create({
          percent_off:        pendingOffer.discountPercent,
          duration:           "repeating",
          duration_in_months: months,
          name:               `Sales Offer ${pendingOffer.token}`,
        })
        couponId = coupon.id
      } else if (pendingOffer.offerType === "FREE_MONTHS" && pendingOffer.freeMonths) {
        const coupon = await stripe.coupons.create({
          percent_off:        100,
          duration:           "repeating",
          duration_in_months: pendingOffer.freeMonths,
          name:               `${pendingOffer.freeMonths} Free Month${pendingOffer.freeMonths !== 1 ? "s" : ""} — ${pendingOffer.token}`,
        })
        couponId = coupon.id
      }
      // FLAT_PRICE handled below via price_data — no coupon needed
    } else if (org.discountPercent && org.discountPercent > 0) {
      if (org.stripeCouponId) {
        couponId = org.stripeCouponId
      } else {
        const now = new Date()
        const expiresAt = org.discountExpiresAt
        const months = expiresAt
          ? Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
          : 12
        const coupon = await stripe.coupons.create({
          percent_off:        org.discountPercent,
          duration:           "repeating",
          duration_in_months: months,
        })
        couponId = coupon.id
        await prisma.organization.update({
          where: { id: org.id },
          data:  { stripeCouponId: coupon.id },
        })
      }
    }

    // Build line items — flat-price offers replace all line items with a single custom price
    const isFlatPrice = pendingOffer?.offerType === "FLAT_PRICE" && pendingOffer.flatMonthlyPrice
    const lineItems = isFlatPrice
      ? [{
          price_data: {
            currency:    "usd",
            unit_amount: Math.round(pendingOffer!.flatMonthlyPrice! * 100),
            recurring:   { interval: "month" as const },
            product_data: {
              name:     `Relay ${body.plan.charAt(0).toUpperCase() + body.plan.slice(1).replace(/_/g, " ")} (Custom)`,
              metadata: { salesOfferToken: pendingOffer!.token },
            },
          },
          quantity: 1,
        }]
      : buildLineItems({
          plan:              body.plan,
          employeeCount,
          locationCount:     body.locationCount,
          selectedModuleIds,
          intelligenceSuite,
        })

    const isWashEssentials = body.plan === "wash_essentials"

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:     "subscription",
      customer: customerId,
      line_items: lineItems,
      ...(couponId ? { discounts: [{ coupon: couponId }] } : (!pendingOffer ? { allow_promotion_codes: true } : {})),
      // Session-level metadata for checkout.session.completed webhook
      metadata: {
        organizationId: org.id,
        ...(pendingOffer ? { salesOfferToken: pendingOffer.token } : {}),
        ...(isWashEssentials ? {
          productLine:   "WASH_ESSENTIALS",
          industry:      "CAR_WASH",
          locationCount: String(body.locationCount),
        } : {}),
      },
      // Subscription-level metadata for customer.subscription.updated webhook
      ...(isWashEssentials ? {
        subscription_data: {
          metadata: {
            organizationId: org.id,
            productLine:    "WASH_ESSENTIALS",
            locationCount:  String(body.locationCount),
          },
        },
      } : {}),
      success_url: `${APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/subscribe`,
    })

    // Persist pricing intent + productLine to DB
    const pricing = calculatePrice({
      plan:              body.plan,
      employeeCount,
      locationCount:     body.locationCount,
      selectedModuleIds,
      intelligenceSuite,
      discountPercent:   org.discountPercent ?? undefined,
    })

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan:                       body.plan,
        productLine:                newProductLine,
        employeeLimit:              employeeCount,
        locationLimit:              body.locationCount,
        intelligenceModules:        intelligenceSuite
          ? ["issue_intelligence", "sop_intelligence", "asset_intelligence", "benchmark_intelligence", "purchase_intelligence"]
          : selectedModuleIds,
        intelligenceSuiteEnabled:   intelligenceSuite,
        monthlyBasePrice:           pricing.basePrice,
        monthlyScalingCost:         pricing.employeeScaling + pricing.locationScaling,
        monthlyModulesCost:         pricing.moduleCost,
        monthlyTotalBeforeDiscount: pricing.totalBeforeDiscount,
        monthlyTotalAfterDiscount:  pricing.totalAfterDiscount,
        checkoutIntentStatus:       "pending",
      },
    })

    // Refresh session so feature gating reflects the new plan/productLine immediately.
    // This is important for Wash Essentials: the customer should see the correct
    // product experience without needing to log out and back in.
    await createSession({ ...session, plan: body.plan, productLine: newProductLine })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("organizationId", org.id)
      Sentry.captureException(err)
    })
    console.error("Stripe checkout error:", err)
    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 },
    )
  }
}
