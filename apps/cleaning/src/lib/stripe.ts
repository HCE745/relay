import { createHmac, timingSafeEqual } from "node:crypto"

// Minimal Stripe over the REST API (no SDK dependency), mirroring email/sms.
// Supports card + ACH via Checkout, and verifies webhook signatures by hand.
//
// Required env:
//   STRIPE_SECRET_KEY       (sk_...)   — create Checkout Sessions
//   STRIPE_WEBHOOK_SECRET   (whsec_...) — verify inbound webhook signatures
//   CLEANING_APP_URL        — base for success/cancel redirects (falls back to request origin)

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export type CheckoutInput = {
  amountCents: number
  currency: string
  invoiceId: string
  orgId: string
  invoiceNumber: number
  successUrl: string
  cancelUrl: string
  customerEmail?: string
}

/** Create a Stripe Checkout Session (card + US bank ACH). Returns the hosted URL. */
export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  const form = new URLSearchParams()
  form.set("mode", "payment")
  form.set("success_url", input.successUrl)
  form.set("cancel_url", input.cancelUrl)
  form.append("payment_method_types[]", "card")
  form.append("payment_method_types[]", "us_bank_account")
  form.set("client_reference_id", input.invoiceId)
  form.set("metadata[invoiceId]", input.invoiceId)
  form.set("metadata[orgId]", input.orgId)
  if (input.customerEmail) form.set("customer_email", input.customerEmail)
  form.set("line_items[0][quantity]", "1")
  form.set("line_items[0][price_data][currency]", input.currency.toLowerCase())
  form.set("line_items[0][price_data][unit_amount]", String(input.amountCents))
  form.set("line_items[0][price_data][product_data][name]", `Invoice #${input.invoiceNumber}`)
  // Carry metadata onto the PaymentIntent too, for reconciliation.
  form.set("payment_intent_data[metadata][invoiceId]", input.invoiceId)

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  const data = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null
  if (!res.ok || !data?.url || !data?.id) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`)
  return { id: data.id, url: data.url }
}

/**
 * Verify a Stripe webhook signature (Stripe-Signature: "t=…,v1=…"). The signed
 * payload is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret, compared
 * constant-time, with a replay-tolerance window. Returns false on any mismatch
 * or when no secret is configured (reject by default on a public endpoint).
 */
export function verifyStripeSignature(rawBody: string, header: string | null, opts: { secret?: string; toleranceSec?: number; nowSec?: number } = {}): boolean {
  const secret = opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !header) return false
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=").map((s) => s.trim())).filter((kv) => kv.length === 2))
  const t = parts["t"]
  const v1 = parts["v1"]
  if (!t || !v1) return false
  const tolerance = opts.toleranceSec ?? 300
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(t)) > tolerance) return false
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex")
  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(v1, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Build a signed Stripe-Signature header (used by tests / local tooling). */
export function signStripePayload(rawBody: string, secret: string, tSec: number): string {
  const sig = createHmac("sha256", secret).update(`${tSec}.${rawBody}`, "utf8").digest("hex")
  return `t=${tSec},v1=${sig}`
}
