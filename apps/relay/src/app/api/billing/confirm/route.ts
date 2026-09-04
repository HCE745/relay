import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    )
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { setupIntentId } = await request.json()
  if (!setupIntentId) {
    return NextResponse.json({ error: "setupIntentId is required" }, { status: 400 })
  }

  // Retrieve the confirmed SetupIntent to get the payment method
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
  if (setupIntent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment setup not completed" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { stripeCustomerId: true },
  })

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 })
  }

  const paymentMethodId = setupIntent.payment_method as string

  // Set as default payment method on the customer
  await stripe.customers.update(org.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  // Create subscription if STRIPE_PRICE_ID is configured
  const priceId = process.env.STRIPE_PRICE_ID
  if (priceId) {
    await stripe.subscriptions.create({
      customer:               org.stripeCustomerId,
      items:                  [{ price: priceId }],
      default_payment_method: paymentMethodId,
    })
  }

  // Mark org as active
  await prisma.organization.update({
    where: { id: session.organizationId },
    data:  { subscriptionStatus: "active" },
  })

  // Refresh session so middleware no longer redirects to /billing
  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role:                session.role,
    organizationId:      session.organizationId,
    onboardingCompleted: session.onboardingCompleted,
    trialEndsAt:         session.trialEndsAt,
    subscriptionStatus:  "active",
    plan:                session.plan,
  })

  return NextResponse.json({ success: true })
}
