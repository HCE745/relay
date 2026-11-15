import { describe, it, expect, afterEach, vi } from "vitest"
import {
  isSubscriptionEnforcementEnabled,
  subscriptionAccess,
  seatLimit,
  canAddActiveSeat,
  type OrgAccessInput,
} from "../access"

const NOW = new Date("2026-11-15T00:00:00Z")
const future = new Date("2026-12-01T00:00:00Z")
const past = new Date("2026-11-01T00:00:00Z")

const base: OrgAccessInput = {
  isDemo: false,
  subscriptionStatus: "canceled",
  trialEndsAt: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
}

afterEach(() => vi.unstubAllEnvs())

describe("enforcement master switch", () => {
  it("is OFF unless explicitly enabled", () => {
    expect(isSubscriptionEnforcementEnabled()).toBe(false)
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "off")
    expect(isSubscriptionEnforcementEnabled()).toBe(false)
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "on")
    expect(isSubscriptionEnforcementEnabled()).toBe(true)
  })
})

describe("subscriptionAccess", () => {
  it("allows a demo org regardless of billing state", () => {
    expect(subscriptionAccess({ ...base, isDemo: true }, NOW).allowed).toBe(true)
  })

  it("allows an active paid subscription within its period", () => {
    const r = subscriptionAccess(
      { ...base, subscriptionStatus: "active", stripeSubscriptionId: "sub_1", currentPeriodEnd: future },
      NOW,
    )
    expect(r.allowed).toBe(true)
  })

  it("allows active paid with no period end set (open-ended)", () => {
    expect(
      subscriptionAccess({ ...base, subscriptionStatus: "active", stripeSubscriptionId: "sub_1", currentPeriodEnd: null }, NOW).allowed,
    ).toBe(true)
  })

  it("DENIES active past the paid-through date (lapsed renewal)", () => {
    expect(
      subscriptionAccess({ ...base, subscriptionStatus: "active", stripeSubscriptionId: "sub_1", currentPeriodEnd: past }, NOW).allowed,
    ).toBe(false)
  })

  it("DENIES 'active' with NO Stripe subscription (un-migrated legacy org)", () => {
    // This is the deliberate reason enforcement waits for the legacy backfill.
    expect(
      subscriptionAccess({ ...base, subscriptionStatus: "active", stripeSubscriptionId: null }, NOW).allowed,
    ).toBe(false)
  })

  it("allows a trial that has not expired, denies one that has", () => {
    expect(subscriptionAccess({ ...base, subscriptionStatus: "trialing", trialEndsAt: future }, NOW).allowed).toBe(true)
    expect(subscriptionAccess({ ...base, subscriptionStatus: "trialing", trialEndsAt: past }, NOW).allowed).toBe(false)
    expect(subscriptionAccess({ ...base, subscriptionStatus: "trialing", trialEndsAt: null }, NOW).allowed).toBe(false)
  })

  it("DENIES past_due and canceled", () => {
    expect(subscriptionAccess({ ...base, subscriptionStatus: "past_due", stripeSubscriptionId: "sub_1" }, NOW).allowed).toBe(false)
    expect(subscriptionAccess({ ...base, subscriptionStatus: "canceled", stripeSubscriptionId: "sub_1" }, NOW).allowed).toBe(false)
  })

  it("treats the legacy grace (trialing + bounded trialEndsAt) as a valid trial", () => {
    const graceEnd = new Date("2026-11-29T00:00:00Z") // activation + 14 days
    expect(subscriptionAccess({ ...base, subscriptionStatus: "trialing", trialEndsAt: graceEnd }, NOW).allowed).toBe(true)
  })
})

describe("seat limits (validated against Stripe-synced quantities)", () => {
  it("seatLimit = included + purchased, capped at the tier max", () => {
    expect(seatLimit("SOLO", 0)).toBe(3) // no add-on
    expect(seatLimit("SOLO", 5)).toBe(3) // Solo can't buy seats → capped at included
    expect(seatLimit("TEAM", 0)).toBe(10)
    expect(seatLimit("TEAM", 4)).toBe(14)
    expect(seatLimit("TEAM", 100)).toBe(24) // capped at Essentials max
    expect(seatLimit("BUSINESS", 10)).toBe(35)
    expect(seatLimit("BUSINESS", 1000)).toBe(100) // capped at Professional max
  })

  it("canAddActiveSeat stops at the limit (CLIENT users excluded by the caller's count)", () => {
    expect(canAddActiveSeat("TEAM", 0, 9)).toBe(true) // 9 < 10
    expect(canAddActiveSeat("TEAM", 0, 10)).toBe(false) // at limit
    expect(canAddActiveSeat("TEAM", 2, 11)).toBe(true) // limit 12
    expect(canAddActiveSeat("SOLO", 0, 3)).toBe(false) // Solo included 3, full
  })
})
