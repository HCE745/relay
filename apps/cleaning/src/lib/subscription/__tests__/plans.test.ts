import { describe, it, expect } from "vitest"
import {
  getPlan,
  isPurchasableTier,
  includedSeatsFor,
  maxSeatsFor,
  purchasablePlans,
  TRIAL_DAYS,
} from "../plans"

describe("subscription plan registry", () => {
  it("exposes exactly the three self-serve plans, ascending", () => {
    expect(purchasablePlans().map((p) => p.tier)).toEqual(["SOLO", "TEAM", "BUSINESS"])
    expect(purchasablePlans().map((p) => p.name)).toEqual(["Solo", "Essentials", "Professional"])
  })

  it("ENTERPRISE and unknown tiers are not purchasable (contact-sales)", () => {
    expect(getPlan("ENTERPRISE")).toBeNull()
    expect(getPlan("NONSENSE")).toBeNull()
    expect(isPurchasableTier("ENTERPRISE")).toBe(false)
    expect(isPurchasableTier("SOLO")).toBe(true)
  })

  it("prices match the published rate card (cents)", () => {
    expect(getPlan("SOLO")!.amountCents).toEqual({ monthly: 4900, annual: 49980 })
    expect(getPlan("TEAM")!.amountCents).toEqual({ monthly: 9900, annual: 100980 })
    expect(getPlan("BUSINESS")!.amountCents).toEqual({ monthly: 19900, annual: 202980 })
  })

  it("included seats are 3 / 10 / 25", () => {
    expect(includedSeatsFor("SOLO")).toBe(3)
    expect(includedSeatsFor("TEAM")).toBe(10)
    expect(includedSeatsFor("BUSINESS")).toBe(25)
    expect(includedSeatsFor("ENTERPRISE")).toBe(0)
  })

  it("seat add-on: Solo has none (upgrade required); Essentials/Professional priced + capped", () => {
    expect(getPlan("SOLO")!.seatAddOn).toBeNull()

    const ess = getPlan("TEAM")!.seatAddOn!
    expect(ess.amountCents).toEqual({ monthly: 500, annual: 5100 })
    expect(ess.maxSeats).toBe(24)

    const pro = getPlan("BUSINESS")!.seatAddOn!
    expect(pro.amountCents).toEqual({ monthly: 400, annual: 4080 })
    expect(pro.maxSeats).toBe(100)
  })

  it("maxSeatsFor returns the hard cap (included when no add-on, else add-on max)", () => {
    expect(maxSeatsFor("SOLO")).toBe(3) // no add-on → included is the cap
    expect(maxSeatsFor("TEAM")).toBe(24)
    expect(maxSeatsFor("BUSINESS")).toBe(100)
    expect(maxSeatsFor("ENTERPRISE")).toBe(0)
  })

  it("carries operating-location allowances as FUTURE config (1/2/4) — enforcement lives elsewhere", () => {
    expect(getPlan("SOLO")!.includedOperatingLocations).toBe(1)
    expect(getPlan("TEAM")!.includedOperatingLocations).toBe(2)
    expect(getPlan("BUSINESS")!.includedOperatingLocations).toBe(4)
  })

  it("maps the ten Stripe price env var names exactly (drift guard)", () => {
    const names = purchasablePlans().flatMap((p) => [
      p.priceEnv.monthly,
      p.priceEnv.annual,
      ...(p.seatAddOn ? [p.seatAddOn.priceEnv.monthly, p.seatAddOn.priceEnv.annual] : []),
    ])
    expect(names.sort()).toEqual(
      [
        "STRIPE_BILLING_PRICE_SOLO_MONTHLY",
        "STRIPE_BILLING_PRICE_SOLO_ANNUAL",
        "STRIPE_BILLING_PRICE_ESSENTIALS_MONTHLY",
        "STRIPE_BILLING_PRICE_ESSENTIALS_ANNUAL",
        "STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_MONTHLY",
        "STRIPE_BILLING_PRICE_ESSENTIALS_SEAT_ANNUAL",
        "STRIPE_BILLING_PRICE_PROFESSIONAL_MONTHLY",
        "STRIPE_BILLING_PRICE_PROFESSIONAL_ANNUAL",
        "STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_MONTHLY",
        "STRIPE_BILLING_PRICE_PROFESSIONAL_SEAT_ANNUAL",
      ].sort(),
    )
    expect(names).toHaveLength(10)
  })

  it("the free trial is 14 days", () => {
    expect(TRIAL_DAYS).toBe(14)
  })
})
