import { NextResponse } from "next/server"
import { verifyBillingSignature, fetchSubscription } from "@/lib/subscription/stripe-subscriptions"
import {
  buildPriceLookup,
  subscriptionIdFromEvent,
  subscriptionToOrgFields,
  type StripeEvent,
  type StripeSubscription,
} from "@/lib/subscription/sync"
import { applySubscriptionEvent } from "@/lib/data/subscription"

// PUBLIC, unauthenticated CleanWare SaaS-billing webhook. SEPARATE endpoint and
// SEPARATE Stripe account from the customer-invoice webhook (/api/stripe/webhook)
// — it verifies with STRIPE_BILLING_WEBHOOK_SECRET only. Signature verification
// is MANDATORY (forged events rejected 401). Idempotent via the ProcessedStripe-
// Event ledger. Stripe is the source of truth: for every handled event we
// re-fetch the live subscription, so out-of-order delivery is harmless.
export async function POST(request: Request) {
  const raw = await request.text()
  const sig = request.headers.get("stripe-signature")
  if (!verifyBillingSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(raw) as StripeEvent
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 })
  }

  const subscriptionId = subscriptionIdFromEvent(event)
  if (!subscriptionId) {
    // Not a subscription-lifecycle event we act on — acknowledge so Stripe stops
    // retrying. (One-off invoice payments live on the other webhook.)
    return NextResponse.json({ received: true })
  }

  try {
    const sub = (await fetchSubscription(subscriptionId)) as StripeSubscription
    const fields = subscriptionToOrgFields(sub, buildPriceLookup())
    await applySubscriptionEvent({ eventId: event.id, type: event.type, fields })
  } catch {
    // Transient failure (Stripe fetch / DB) — 500 tells Stripe to retry, and the
    // idempotency ledger makes the retry safe.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
