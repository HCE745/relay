import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail, paymentConfirmationEmail, paymentFailedEmail } from "@/lib/email"
import { setLifecycle } from "@/lib/crm-lifecycle"
import { setWorkforceCommsPlanFlags } from "@/lib/workforce-comms"
import * as Sentry from "@sentry/nextjs"
import type Stripe from "stripe"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 })

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription)
        break
    }
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("stripeEventType", event.type)
      Sentry.captureException(err)
    })
    console.error("[Stripe webhook] Handler error:", err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.organizationId
  if (!orgId) return

  const org = await prisma.organization.findUnique({
    where:  { id: orgId },
    select: { lifecycleStatus: true, plan: true },
  })

  // Derive productLine: prefer session metadata (set by checkout-intent), fall back to DB plan.
  const productLine =
    session.metadata?.productLine === "WASH_ESSENTIALS" || org?.plan === "wash_essentials"
      ? "WASH_ESSENTIALS"
      : "RELAY_STANDARD"

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      subscriptionStatus:   "active",
      checkoutIntentStatus: "completed",
      stripeSubscriptionId: (session.subscription as string | null) ?? undefined,
      productLine,
    },
  })

  if (org) {
    await setLifecycle(orgId, "Converted", "Stripe", org.lifecycleStatus)
    await setWorkforceCommsPlanFlags(orgId, org.plan)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.customer) return

  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
    include: { users: { where: { role: "ADMIN", isActive: true }, select: { name: true, email: true }, take: 1 } },
  })
  if (!org) return

  const admin = org.users[0]
  if (!admin?.email) return

  const amount     = invoice.amount_paid
  const currency   = invoice.currency.toUpperCase()
  const periodEnd  = invoice.period_end
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(invoice.period_end * 1000))
    : "—"
  const periodStart = invoice.period_start
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(invoice.period_start * 1000))
    : "—"
  const nextDate   = invoice.next_payment_attempt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(invoice.next_payment_attempt * 1000))
    : "—"

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const billingUrl = `${appUrl}/settings/billing`
  const planName   = org.plan.charAt(0).toUpperCase() + org.plan.slice(1)

  await prisma.organization.update({
    where: { id: org.id },
    data:  { subscriptionStatus: "active" },
  })

  await sendEmail({
    to:      admin.email,
    subject: `Payment confirmed — Relay ${planName}`,
    html:    paymentConfirmationEmail({
      name:            admin.name,
      planName,
      amount,
      currency,
      billingPeriod:   `${periodStart} – ${periodEnd}`,
      nextBillingDate: nextDate,
      billingUrl,
    }),
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return

  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
    include: { users: { where: { role: "ADMIN", isActive: true }, select: { name: true, email: true }, take: 1 } },
  })
  if (!org) return

  const admin = org.users[0]
  if (!admin?.email) return

  const amount    = invoice.amount_due
  const currency  = invoice.currency.toUpperCase()
  const failedAt  = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date())
  const retryDate = invoice.next_payment_attempt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(invoice.next_payment_attempt * 1000))
    : undefined

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const billingUrl = `${appUrl}/settings/billing`
  const planName   = org.plan.charAt(0).toUpperCase() + org.plan.slice(1)

  await prisma.organization.update({
    where: { id: org.id },
    data:  { subscriptionStatus: "past_due" },
  })

  await sendEmail({
    to:      admin.email,
    subject: "Action required: Payment failed for Relay",
    html:    paymentFailedEmail({ name: admin.name, planName, amount, currency, failedDate: failedAt, retryDate, billingUrl }),
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
  if (!customerId) return

  const statusMap: Record<string, string | undefined> = {
    active:   "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid:   "past_due",
  }
  const newStatus = statusMap[subscription.status]
  if (!newStatus) return

  // For Wash Essentials subscriptions: sync locationLimit from the per-location add-on line item.
  // subscription.metadata is set by checkout-intent (subscription_data.metadata).
  const weLocationPriceId = process.env.STRIPE_PRICE_WASH_ESSENTIALS_LOCATION
  const isWeSubscription  = subscription.metadata?.productLine === "WASH_ESSENTIALS"

  if (isWeSubscription && weLocationPriceId) {
    // subscription.items.data[].price is expanded in webhook payloads
    const locationItem = subscription.items.data.find(
      item => (item.price as Stripe.Price).id === weLocationPriceId,
    )
    const additionalCount = locationItem?.quantity ?? 0
    const newLocationLimit = additionalCount + 1  // 1 base location is always included

    const org = await prisma.organization.findFirst({
      where:  { stripeCustomerId: customerId },
      select: { id: true },
    })
    if (org) {
      await prisma.organization.update({
        where: { id: org.id },
        data:  { subscriptionStatus: newStatus, locationLimit: newLocationLimit },
      })
      return
    }
  }

  await prisma.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data:  { subscriptionStatus: newStatus },
  })
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
  if (!customerId) return

  const orgs = await prisma.organization.findMany({
    where:  { stripeCustomerId: customerId },
    select: { id: true, lifecycleStatus: true },
  })

  await prisma.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data:  { subscriptionStatus: "canceled" },
  })

  for (const org of orgs) {
    await setLifecycle(org.id, "Cancelled", "Stripe", org.lifecycleStatus)
  }
}
