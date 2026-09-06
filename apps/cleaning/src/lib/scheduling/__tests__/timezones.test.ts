import { describe, it, expect } from "vitest"
import { isValidTimezone, listTimezones } from "../timezones"

describe("isValidTimezone", () => {
  it("accepts valid IANA identifiers", () => {
    expect(isValidTimezone("America/New_York")).toBe(true)
    expect(isValidTimezone("America/Los_Angeles")).toBe(true)
    expect(isValidTimezone("UTC")).toBe(true)
  })
  it("rejects invalid / non-IANA text", () => {
    expect(isValidTimezone("Eastern Time")).toBe(false)
    expect(isValidTimezone("Not/AZone")).toBe(false)
    expect(isValidTimezone("")).toBe(false)
  })
})

describe("listTimezones", () => {
  it("returns a non-empty list including common zones", () => {
    const zones = listTimezones()
    expect(zones.length).toBeGreaterThan(0)
    expect(zones).toContain("America/New_York")
  })
})
