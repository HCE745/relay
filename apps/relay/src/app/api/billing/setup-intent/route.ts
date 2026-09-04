import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST() {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    )
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { stripeCustomerId: true, name: true },
  })

  // Create or reuse Stripe customer
  let customerId = org?.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name:  org?.name ?? session.name,
      metadata: { organizationId: session.organizationId },
    })
    customerId = customer.id
    await prisma.organization.update({
      where: { id: session.organizationId },
      data:  { stripeCustomerId: customerId },
    })
  }

  const setupIntent = await stripe.setupIntents.create({
    customer:             customerId,
    payment_method_types: ["card"],
    usage:                "off_session",
    metadata:             { organizationId: session.organizationId },
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
