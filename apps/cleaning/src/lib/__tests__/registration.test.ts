import { describe, it, expect, afterEach, vi } from "vitest"
import { isPublicRegistrationEnabled, buildOrgSlug, coerceTrialTier, TRIAL_TIER } from "../registration"
import { TRIAL_DAYS } from "../subscription/plans"
import { signUpSchema, billingCheckoutSchema } from "../zod-schemas"

afterEach(() => vi.unstubAllEnvs())

describe("public registration master switch", () => {
  it("is OFF unless explicitly enabled", () => {
    expect(isPublicRegistrationEnabled()).toBe(false)
    vi.stubEnv("CLEANING_PUBLIC_REGISTRATION", "off")
    expect(isPublicRegistrationEnabled()).toBe(false)
    vi.stubEnv("CLEANING_PUBLIC_REGISTRATION", "true")
    expect(isPublicRegistrationEnabled()).toBe(false) // only the literal "on" enables it
    vi.stubEnv("CLEANING_PUBLIC_REGISTRATION", "on")
    expect(isPublicRegistrationEnabled()).toBe(true)
  })
})

describe("buildOrgSlug", () => {
  it("slugifies the company name and appends the suffix", () => {
    expect(buildOrgSlug("Summit Facility Services", "ab12cd")).toBe("summit-facility-services-ab12cd")
  })
  it("collapses punctuation and trims leading/trailing separators", () => {
    expect(buildOrgSlug("  A&B  Cleaning, LLC!! ", "f00")).toBe("a-b-cleaning-llc-f00")
  })
  it("falls back to 'org' when the name has no slug-able characters", () => {
    expect(buildOrgSlug("!!!", "9z9")).toBe("org-9z9")
  })
})

describe("trial defaults", () => {
  it("defaults to Essentials (TEAM) for a 14-day no-card evaluation", () => {
    expect(TRIAL_TIER).toBe("TEAM")
    expect(TRIAL_DAYS).toBe(14)
  })
})

describe("coerceTrialTier", () => {
  it("accepts the three self-serve tiers", () => {
    expect(coerceTrialTier("SOLO")).toBe("SOLO")
    expect(coerceTrialTier("TEAM")).toBe("TEAM")
    expect(coerceTrialTier("BUSINESS")).toBe("BUSINESS")
  })
  it("falls back to the default for ENTERPRISE, junk, or non-strings", () => {
    expect(coerceTrialTier("ENTERPRISE")).toBe(TRIAL_TIER) // contact-sales, never a trial
    expect(coerceTrialTier("free")).toBe(TRIAL_TIER)
    expect(coerceTrialTier(undefined)).toBe(TRIAL_TIER)
    expect(coerceTrialTier(123)).toBe(TRIAL_TIER)
  })
})

describe("signUpSchema", () => {
  const base = { orgName: "Acme", name: "Al", email: "AL@Acme.CO", password: "supersecret", timezone: "America/New_York" }
  it("lowercases the email and defaults the trial tier to TEAM", () => {
    const r = signUpSchema.parse(base)
    expect(r.email).toBe("al@acme.co")
    expect(r.trialTier).toBe("TEAM")
  })
  it("accepts a chosen self-serve tier but rejects ENTERPRISE / unknown", () => {
    expect(signUpSchema.parse({ ...base, trialTier: "BUSINESS" }).trialTier).toBe("BUSINESS")
    expect(signUpSchema.safeParse({ ...base, trialTier: "ENTERPRISE" }).success).toBe(false)
  })
  it("rejects a short password and a bad email", () => {
    expect(signUpSchema.safeParse({ ...base, password: "short" }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, email: "nope" }).success).toBe(false)
  })
})

describe("billingCheckoutSchema", () => {
  it("accepts a purchasable tier + interval, with optional extra seats", () => {
    expect(billingCheckoutSchema.parse({ tier: "TEAM", interval: "monthly" }).extraSeats).toBeUndefined()
    expect(billingCheckoutSchema.parse({ tier: "BUSINESS", interval: "annual", extraSeats: 5 }).extraSeats).toBe(5)
  })
  it("rejects ENTERPRISE, bad intervals, and out-of-range / fractional seats", () => {
    expect(billingCheckoutSchema.safeParse({ tier: "ENTERPRISE", interval: "monthly" }).success).toBe(false)
    expect(billingCheckoutSchema.safeParse({ tier: "TEAM", interval: "weekly" }).success).toBe(false)
    expect(billingCheckoutSchema.safeParse({ tier: "TEAM", interval: "monthly", extraSeats: -1 }).success).toBe(false)
    expect(billingCheckoutSchema.safeParse({ tier: "TEAM", interval: "monthly", extraSeats: 2.5 }).success).toBe(false)
    expect(billingCheckoutSchema.safeParse({ tier: "TEAM", interval: "monthly", extraSeats: 101 }).success).toBe(false)
  })
})
