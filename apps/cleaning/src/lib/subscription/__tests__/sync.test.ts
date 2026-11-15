import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  buildPriceLookup,
  mapSubscriptionStatus,
  subscriptionToOrgFields,
  subscriptionIdFromEvent,
  decideSubscriptionUpdate,
  type StripeSubscription,
  type OrgSubscriptionFields,
} from "../sync"

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
  for (const [k, v] of Object.entries(PRICE_ENV)) vi.stubEnv(k, v)
})
afterEach(() => vi.unstubAllEnvs())

describe("buildPriceLookup", () => {
  it("maps every configured base + seat price to its meaning", () => {
    const m = buildPriceLookup()
    expect(m.get("price_ess_m")).toEqual({ tier: "TEAM", interval: "monthly", isSeat: false })
    expect(m.get("price_pro_a")).toEqual({ tier: "BUSINESS", interval: "annual", isSeat: false })
    expect(m.get("price_ess_seat_m")).toEqual({ tier: "TEAM", interval: "monthly", isSeat: true })
    expect(m.get("price_pro_seat_a")).toEqual({ tier: "BUSINESS", interval: "annual", isSeat: true })
    expect(m.size).toBe(10)
  })

  it("is tolerant of unset prices (absent, not throwing)", () => {
    vi.stubEnv("STRIPE_BILLING_PRICE_SOLO_MONTHLY", "")
    const m = buildPriceLookup()
    expect(m.has("price_solo_m")).toBe(false)
    expect(m.size).toBe(9)
  })
})

describe("mapSubscriptionStatus", () => {
  it("maps Stripe statuses onto our coarse set, never silently 'active'", () => {
    expect(mapSubscriptionStatus("trialing")).toBe("trialing")
    expect(mapSubscriptionStatus("active")).toBe("active")
    expect(mapSubscriptionStatus("past_due")).toBe("past_due")
    expect(mapSubscriptionStatus("unpaid")).toBe("past_due")
    expect(mapSubscriptionStatus("incomplete")).toBe("past_due")
    expect(mapSubscriptionStatus("paused")).toBe("past_due")
    expect(mapSubscriptionStatus("canceled")).toBe("canceled")
    expect(mapSubscriptionStatus("incomplete_expired")).toBe("canceled")
    expect(mapSubscriptionStatus("something_new")).toBe("past_due")
    expect(mapSubscriptionStatus(undefined)).toBe("past_due")
  })
})

describe("subscriptionToOrgFields", () => {
  const lookup = () => buildPriceLookup()

  it("maps a plain Essentials monthly subscription", () => {
    const sub: StripeSubscription = {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      current_period_end: 1_900_000_000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_ess_m" }, quantity: 1 }] },
      metadata: { orgId: "org_1" },
    }
    expect(subscriptionToOrgFields(sub, lookup())).toEqual<OrgSubscriptionFields>({
      orgId: "org_1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      packageTier: "TEAM",
      billingInterval: "monthly",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(1_900_000_000 * 1000),
      cancelAtPeriodEnd: false,
      purchasedSeats: 0,
    })
  })

  it("reads purchased seats from the add-on line and a nested customer object", () => {
    const sub: StripeSubscription = {
      id: "sub_2",
      customer: { id: "cus_2" },
      status: "trialing",
      current_period_end: 1_800_000_000,
      cancel_at_period_end: true,
      items: {
        data: [
          { price: { id: "price_pro_a" }, quantity: 1 },
          { price: { id: "price_pro_seat_a" }, quantity: 7 },
        ],
      },
      metadata: { orgId: "org_2" },
    }
    const f = subscriptionToOrgFields(sub, lookup())
    expect(f.packageTier).toBe("BUSINESS")
    expect(f.billingInterval).toBe("annual")
    expect(f.purchasedSeats).toBe(7)
    expect(f.cancelAtPeriodEnd).toBe(true)
    expect(f.subscriptionStatus).toBe("trialing")
    expect(f.stripeCustomerId).toBe("cus_2")
  })

  it("leaves tier/interval UNDEFINED for an unrecognized base price (never guesses)", () => {
    const sub: StripeSubscription = {
      id: "sub_3",
      customer: "cus_3",
      status: "active",
      items: { data: [{ price: { id: "price_unknown" }, quantity: 1 }] },
      metadata: { orgId: "org_3" },
    }
    const f = subscriptionToOrgFields(sub, lookup())
    expect(f.packageTier).toBeUndefined()
    expect(f.billingInterval).toBeUndefined()
    expect(f.subscriptionStatus).toBe("active")
  })

  it("falls back to an item-level period end when the top level is absent", () => {
    const sub: StripeSubscription = {
      id: "sub_4",
      customer: "cus_4",
      status: "active",
      current_period_end: null,
      items: { data: [{ price: { id: "price_solo_m" }, quantity: 1, current_period_end: 1_700_000_000 }] },
      metadata: { orgId: "org_4" },
    }
    expect(subscriptionToOrgFields(sub, lookup()).currentPeriodEnd).toEqual(new Date(1_700_000_000 * 1000))
  })

  it("has a null orgId when metadata is missing (webhook then falls back to customer id)", () => {
    const sub: StripeSubscription = { id: "sub_5", customer: "cus_5", status: "active", items: { data: [] } }
    const f = subscriptionToOrgFields(sub, lookup())
    expect(f.orgId).toBeNull()
    expect(f.stripeCustomerId).toBe("cus_5")
  })
})

describe("subscriptionIdFromEvent", () => {
  const ev = (type: string, object: Record<string, unknown>) => ({ id: "evt", type, data: { object } })

  it("extracts the subscription id for the handled event types", () => {
    expect(subscriptionIdFromEvent(ev("checkout.session.completed", { mode: "subscription", subscription: "sub_a" }))).toBe("sub_a")
    expect(subscriptionIdFromEvent(ev("customer.subscription.updated", { id: "sub_b" }))).toBe("sub_b")
    expect(subscriptionIdFromEvent(ev("customer.subscription.deleted", { id: "sub_c" }))).toBe("sub_c")
    expect(subscriptionIdFromEvent(ev("invoice.paid", { subscription: "sub_d" }))).toBe("sub_d")
    expect(subscriptionIdFromEvent(ev("invoice.payment_failed", { subscription: "sub_e" }))).toBe("sub_e")
  })

  it("ignores a one-off (non-subscription) checkout — that belongs to the invoice webhook", () => {
    expect(subscriptionIdFromEvent(ev("checkout.session.completed", { mode: "payment", subscription: null }))).toBeNull()
  })

  it("returns null for unhandled event types", () => {
    expect(subscriptionIdFromEvent(ev("customer.updated", { id: "cus_x" }))).toBeNull()
    expect(subscriptionIdFromEvent(ev("invoice.paid", {}))).toBeNull()
  })
})

describe("decideSubscriptionUpdate (one-live-subscription-per-org duplicate guard)", () => {
  const fields = (subId: string): OrgSubscriptionFields => ({
    orgId: "org_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: subId,
    subscriptionStatus: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    purchasedSeats: 0,
  })

  it("updates when the org has no subscription yet", () => {
    const d = decideSubscriptionUpdate({ stripeSubscriptionId: null, subscriptionStatus: "trialing" }, fields("sub_new"))
    expect(d.action).toBe("update")
  })

  it("updates when the event is for the org's existing subscription", () => {
    const d = decideSubscriptionUpdate({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }, fields("sub_1"))
    expect(d.action).toBe("update")
  })

  it("REFUSES a different subscription while the current one is live (no hijack)", () => {
    const d = decideSubscriptionUpdate({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }, fields("sub_2"))
    expect(d.action).toBe("skip")
    if (d.action === "skip") expect(d.reason).toMatch(/already bound to live subscription sub_1/)
  })

  it("allows rebinding after the current subscription is canceled (resubscribe)", () => {
    const d = decideSubscriptionUpdate({ stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" }, fields("sub_2"))
    expect(d.action).toBe("update")
  })
})
