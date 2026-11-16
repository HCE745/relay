import { describe, it, expect, afterEach, vi } from "vitest"
import { isPublicRegistrationEnabled, buildOrgSlug, TRIAL_TIER } from "../registration"
import { TRIAL_DAYS } from "../subscription/plans"

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
  it("starts trials on Essentials (TEAM) for a 14-day no-card evaluation", () => {
    expect(TRIAL_TIER).toBe("TEAM")
    expect(TRIAL_DAYS).toBe(14)
  })
})
