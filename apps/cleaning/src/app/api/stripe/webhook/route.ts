import { NextResponse } from "next/server"
import { verifyStripeSignature } from "@/lib/stripe"
import { applyStripePaymentEvent } from "@/lib/data/payments"

// PUBLIC, unauthenticated Stripe webhook. Signature verification is MANDATORY —
// an unsigned or wrongly-signed request is rejected (401). Idempotent: the event
// id dedupes retries. Payments post through the normal InvoicePayment path.
export async function POST(request: Request) {
  const raw = await request.text()
  const sig = request.headers.get("stripe-signature")
  if (!verifyStripeSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }
  let event: { id: string; type: string; data?: { object?: Record<string, unknown> } }
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }) }

  if (event.type === "checkout.session.completed") {
    const s = event.data?.object ?? {}
    const metadata = (s.metadata ?? {}) as Record<string, string>
    const orgId = metadata.orgId
    const invoiceId = metadata.invoiceId
    const amountCents = typeof s.amount_total === "number" ? s.amount_total : 0
    const method = Array.isArray(s.payment_method_types) && s.payment_method_types[0] === "us_bank_account" ? "ach" : "card"
    const reference = typeof s.payment_intent === "string" ? s.payment_intent : event.id
    if (orgId && invoiceId && amountCents > 0 && s.payment_status === "paid") {
      await applyStripePaymentEvent({ eventId: event.id, type: event.type, orgId, invoiceId, amountCents, method, reference })
    }
  }
  // Acknowledge all other events so Stripe stops retrying.
  return NextResponse.json({ received: true })
}
