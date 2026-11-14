import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  isBillingConfigured,
  resolvePriceId,
  verifyBillingSignature,
  createSubscriptionCheckout,
  createBillingPortalSession,
} from "../stripe-subscriptions"
import { signStripePayload } from "../../stripe"

// Capture the most recent fetch call so assertions can read the posted form.
type Captured = { url: string; headers: Record<string, string>; body: URLSearchParams }
let last: Captured | null

function mockStripe(response: Record<string, unknown>, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
      last = { url, headers: init.headers, body: new URLSearchParams(init.body) }
      return { ok, json: async () => response } as unknown as Response
    }),
  )
}

const PRICE_ENV: Record<string, string> = {
  STRIPE_BILLING_PRICE_SOLO_MONTHLY: "price_solo_m",
  STRIPE_BILLING_PRICE_SOLO_ANNUAL: "price_solo_a",
  STRIPE_BILLING_PRICE_ESSENTIALS_MONTHLY: "price_ess_m",
  STRIPE_BILLING_PRICE_ESSENTIALS_ANNUAL: "price_ess_a",
  STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_MONTHLY: "price_ess_seat_m",
  STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_ANNUAL: "price_ess_seat_a",
  STRIPE_BILLING_PRICE_PROFESSIONAL_MONTHLY: "price_pro_m",
  STRIPE_BILLING_PRICE_PROFESSIONAL_ANNUAL: "price_pro_a",
  STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_MONTHLY: "price_pro_seat_m",
  STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_ANNUAL: "price_pro_seat_a",
}

beforeEach(() => {
  last = null
  vi.stubEnv("STRIPE_BILLING_SECRET_KEY", "sk_test_billing")
  for (const [k, v] of Object.entries(PRICE_ENV)) vi.stubEnv(k, v)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("billing configuration", () => {
  it("isBillingConfigured reflects the SEPARATE billing key, not the invoice key", () => {
    expect(isBillingConfigured()).toBe(true)
    vi.stubEnv("STRIPE_BILLING_SECRET_KEY", "")
    expect(isBillingConfigured()).toBe(false)
  })

  it("resolvePriceId returns the mapped id, and throws loudly when unset", () => {
    expect(resolvePriceId("STRIPE_BILLING_PRICE_SOLO_MONTHLY")).toBe("price_solo_m")
    vi.stubEnv("STRIPE_BILLING_PRICE_SOLO_MONTHLY", "")
    expect(() => resolvePriceId("STRIPE_BILLING_PRICE_SOLO_MONTHLY")).toThrow(/Missing Stripe price/)
  })
})

describe("verifyBillingSignature (uses the billing webhook secret only)", () => {
  it("accepts a payload signed with the billing secret, rejects other secrets", () => {
    vi.stubEnv("STRIPE_BILLING_WEBHOOK_SECRET", "whsec_billing")
    const raw = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" })
    const t = Math.floor(Date.now() / 1000)
    expect(verifyBillingSignature(raw, signStripePayload(raw, "whsec_billing", t))).toBe(true)
    // A signature from the INVOICE account's secret must not verify here.
    expect(verifyBillingSignature(raw, signStripePayload(raw, "whsec_invoice", t))).toBe(false)
  })

  it("rejects when the billing webhook secret is unset", () => {
    vi.stubEnv("STRIPE_BILLING_WEBHOOK_SECRET", "")
    const raw = "{}"
    const t = Math.floor(Date.now() / 1000)
    expect(verifyBillingSignature(raw, signStripePayload(raw, "whsec_billing", t))).toBe(false)
  })
})

describe("createSubscriptionCheckout", () => {
  it("builds a subscription-mode session with the base plan line + metadata + idempotency key", async () => {
    mockStripe({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" })
    const out = await createSubscriptionCheckout({
      orgId: "org_1",
      tier: "TEAM",
      interval: "monthly",
      successUrl: "https://app/ok",
      cancelUrl: "https://app/cancel",
      customerEmail: "owner@acme.test",
      idempotencyKey: "sub-checkout:org_1",
    })
    expect(out).toEqual({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" })

    expect(last!.url).toBe("https://api.stripe.com/v1/checkout/sessions")
    expect(last!.headers["idempotency-key"]).toBe("sub-checkout:org_1")
    expect(last!.headers["authorization"]).toBe("Bearer sk_test_billing")
    const b = last!.body
    expect(b.get("mode")).toBe("subscription")
    expect(b.get("client_reference_id")).toBe("org_1")
    expect(b.get("metadata[orgId]")).toBe("org_1")
    expect(b.get("metadata[tier]")).toBe("TEAM")
    expect(b.get("subscription_data[metadata][orgId]")).toBe("org_1")
    expect(b.get("line_items[0][price]")).toBe("price_ess_m")
    expect(b.get("line_items[0][quantity]")).toBe("1")
    expect(b.get("customer_email")).toBe("owner@acme.test")
    // No extra-seat line when none requested.
    expect(b.get("line_items[1][price]")).toBeNull()
  })

  it("adds a per-seat add-on line with the right price and quantity", async () => {
    mockStripe({ id: "cs_2", url: "https://checkout/2" })
    await createSubscriptionCheckout({
      orgId: "org_2",
      tier: "BUSINESS",
      interval: "annual",
      extraSeats: 10,
      successUrl: "https://app/ok",
      cancelUrl: "https://app/cancel",
      stripeCustomerId: "cus_123",
    })
    const b = last!.body
    expect(b.get("line_items[0][price]")).toBe("price_pro_a")
    expect(b.get("line_items[1][price]")).toBe("price_pro_seat_a")
    expect(b.get("line_items[1][quantity]")).toBe("10")
    expect(b.get("customer")).toBe("cus_123")
    expect(b.get("customer_email")).toBeNull()
  })

  it("carries remaining trial days so adding a card mid-trial does not charge immediately", async () => {
    mockStripe({ id: "cs_3", url: "https://checkout/3" })
    await createSubscriptionCheckout({
      orgId: "org_3",
      tier: "SOLO",
      interval: "monthly",
      trialPeriodDays: 9,
      successUrl: "https://app/ok",
      cancelUrl: "https://app/cancel",
    })
    expect(last!.body.get("subscription_data[trial_period_days]")).toBe("9")
  })

  it("refuses extra seats on Solo (no add-on — upgrade required) without calling Stripe", async () => {
    mockStripe({ id: "x", url: "y" })
    await expect(
      createSubscriptionCheckout({
        orgId: "org_4",
        tier: "SOLO",
        interval: "monthly",
        extraSeats: 2,
        successUrl: "https://app/ok",
        cancelUrl: "https://app/cancel",
      }),
    ).rejects.toThrow(/no per-seat add-on|upgrade required/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refuses a seat count above the tier maximum without calling Stripe", async () => {
    mockStripe({ id: "x", url: "y" })
    await expect(
      createSubscriptionCheckout({
        orgId: "org_5",
        tier: "TEAM", // included 10, max 24 → 15 extra = 25 total > 24
        interval: "monthly",
        extraSeats: 15,
        successUrl: "https://app/ok",
        cancelUrl: "https://app/cancel",
      }),
    ).rejects.toThrow(/exceeds the Essentials maximum of 24/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refuses a non-purchasable tier", async () => {
    mockStripe({ id: "x", url: "y" })
    await expect(
      createSubscriptionCheckout({
        orgId: "org_6",
        tier: "ENTERPRISE" as never,
        interval: "monthly",
        successUrl: "https://app/ok",
        cancelUrl: "https://app/cancel",
      }),
    ).rejects.toThrow(/not self-serve purchasable/)
  })

  it("surfaces a Stripe API error message", async () => {
    mockStripe({ error: { message: "No such price" } }, false)
    await expect(
      createSubscriptionCheckout({
        orgId: "org_7",
        tier: "SOLO",
        interval: "monthly",
        successUrl: "https://app/ok",
        cancelUrl: "https://app/cancel",
      }),
    ).rejects.toThrow("No such price")
  })
})

describe("createBillingPortalSession", () => {
  it("posts the customer + return url and returns the portal url", async () => {
    mockStripe({ url: "https://billing.stripe.com/p/session_1" })
    const out = await createBillingPortalSession({
      stripeCustomerId: "cus_9",
      returnUrl: "https://app/settings/billing",
    })
    expect(out.url).toBe("https://billing.stripe.com/p/session_1")
    expect(last!.url).toBe("https://api.stripe.com/v1/billing_portal/sessions")
    expect(last!.body.get("customer")).toBe("cus_9")
    expect(last!.body.get("return_url")).toBe("https://app/settings/billing")
  })
})
