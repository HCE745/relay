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

    // Create or reuse coupon for founding-customer discount
    let couponId: string | undefined
    if (org.discountPercent && org.discountPercent > 0) {
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

    // Build line items from pricing selections
    const lineItems = buildLineItems({
      plan:              body.plan,
      employeeCount,
      locationCount:     body.locationCount,
      selectedModuleIds,
      intelligenceSuite,
    })

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:     "subscription",
      customer: customerId,
      line_items: lineItems,
      ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
      metadata:    { organizationId: org.id },
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
