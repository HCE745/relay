import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import * as Sentry from "@sentry/nextjs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) {
    return NextResponse.json({ error: "Payment service not configured" }, { status: 503 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { id: true, stripeCustomerId: true },
  })

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found. Complete checkout first." }, { status: 404 })
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer:   org.stripeCustomerId,
      return_url: `${APP_URL}/settings/subscription`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("organizationId", org.id)
      Sentry.captureException(err)
    })
    console.error("Billing portal error:", err)
    return NextResponse.json(
      { error: "Failed to open billing portal. Please try again." },
      { status: 500 },
    )
  }
}
