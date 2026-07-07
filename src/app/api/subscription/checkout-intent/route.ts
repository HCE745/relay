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
    plan:              PlanKey
    employeeCount:     number
    locationCount:     number
    selectedModuleIds: ModuleId[]
    intelligenceSuite: boolean  // always true for professional_plus
  }

  // Professional Plus always gets the Intelligence Suite
  if (body.plan === "professional_plus") {
    body.intelligenceSuite = true
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      id:                true,
      name:              true,
      discountPercent:   true,
      discountExpiresAt: true,
      stripeCustomerId:  true,
      stripeCouponId:    true,
    },
  })

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

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
      employeeCount:     body.employeeCount,
      locationCount:     body.locationCount,
      selectedModuleIds: body.selectedModuleIds,
      intelligenceSuite: body.intelligenceSuite,
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

    // Persist pricing intent to DB
    const pricing = calculatePrice({
      plan:              body.plan,
      employeeCount:     body.employeeCount,
      locationCount:     body.locationCount,
      selectedModuleIds: body.selectedModuleIds,
      intelligenceSuite: body.intelligenceSuite,
      discountPercent:   org.discountPercent ?? undefined,
    })

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan:                       body.plan,
        employeeLimit:              body.employeeCount,
        locationLimit:              body.locationCount,
        intelligenceModules:        body.intelligenceSuite
          ? ["issue_intelligence", "sop_intelligence", "asset_intelligence", "benchmark_intelligence", "purchase_intelligence"]
          : body.selectedModuleIds,
        intelligenceSuiteEnabled:   body.intelligenceSuite,
        monthlyBasePrice:           pricing.basePrice,
        monthlyScalingCost:         pricing.employeeScaling + pricing.locationScaling,
        monthlyModulesCost:         pricing.moduleCost,
        monthlyTotalBeforeDiscount: pricing.totalBeforeDiscount,
        monthlyTotalAfterDiscount:  pricing.totalAfterDiscount,
        checkoutIntentStatus:       "pending",
      },
    })

    await createSession({ ...session, plan: body.plan })

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
