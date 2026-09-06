import { describe, it, expect } from "vitest"
import { canUse, resolveCapabilities, parseOverrides } from "../can-use"
import { PACKAGE_CAPABILITIES, PACKAGE_ORDER, capabilitiesForTier } from "../packages"
import { CAPABILITIES, isCapability } from "../capabilities"

describe("package inheritance (SOLO ⊂ TEAM ⊂ BUSINESS ⊂ ENTERPRISE)", () => {
  it("each tier is a strict superset of the one below", () => {
    for (let i = 1; i < PACKAGE_ORDER.length; i++) {
      const lower = PACKAGE_CAPABILITIES[PACKAGE_ORDER[i - 1]]
      const higher = PACKAGE_CAPABILITIES[PACKAGE_ORDER[i]]
      for (const cap of lower) {
        expect(higher.has(cap)).toBe(true)
      }
      expect(higher.size).toBeGreaterThan(lower.size)
    }
  })

  it("SOLO cannot use a Team capability but TEAM can", () => {
    expect(canUse({ packageTier: "SOLO" }, "workforce.timeTracking")).toBe(false)
    expect(canUse({ packageTier: "TEAM" }, "workforce.timeTracking")).toBe(true)
  })

  it("TEAM cannot use a Business capability but BUSINESS and ENTERPRISE can", () => {
    expect(canUse({ packageTier: "TEAM" }, "procurement.purchaseOrders")).toBe(false)
    expect(canUse({ packageTier: "BUSINESS" }, "procurement.purchaseOrders")).toBe(true)
    expect(canUse({ packageTier: "ENTERPRISE" }, "procurement.purchaseOrders")).toBe(true)
  })

  it("ENTERPRISE-only capability is gated below ENTERPRISE", () => {
    expect(canUse({ packageTier: "BUSINESS" }, "enterprise.sso")).toBe(false)
    expect(canUse({ packageTier: "ENTERPRISE" }, "enterprise.sso")).toBe(true)
  })

  it("every capability in the map is a known catalog key", () => {
    for (const tier of PACKAGE_ORDER) {
      for (const cap of capabilitiesForTier(tier)) {
        expect(isCapability(cap)).toBe(true)
      }
    }
  })
})

describe("per-org overrides", () => {
  it("add grants a capability the tier lacks", () => {
    const ctx = { packageTier: "SOLO" as const, capabilityOverrides: { add: ["workforce.timeTracking"] } }
    expect(canUse(ctx, "workforce.timeTracking")).toBe(true)
  })

  it("remove revokes a capability the tier includes", () => {
    const ctx = { packageTier: "TEAM" as const, capabilityOverrides: { remove: ["workforce.timeTracking"] } }
    expect(canUse(ctx, "workforce.timeTracking")).toBe(false)
  })

  it("remove wins over add for the same capability", () => {
    const ctx = {
      packageTier: "SOLO" as const,
      capabilityOverrides: { add: ["operations.issues"], remove: ["operations.issues"] },
    }
    expect(canUse(ctx, "operations.issues")).toBe(false)
  })

  it("ignores unknown capability keys in overrides", () => {
    const ctx = { packageTier: "TEAM" as const, capabilityOverrides: { add: ["not.a.real.cap"] } }
    expect(resolveCapabilities(ctx).has("not.a.real.cap" as never)).toBe(false)
  })
})

describe("canUse edge cases", () => {
  it("returns false for an unknown capability string", () => {
    expect(canUse({ packageTier: "ENTERPRISE" }, "totally.made.up")).toBe(false)
  })

  it("the catalog has no duplicate keys", () => {
    expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length)
  })
})

describe("parseOverrides", () => {
  it("coerces a valid JSON object", () => {
    expect(parseOverrides({ add: ["a"], remove: ["b"] })).toEqual({ add: ["a"], remove: ["b"] })
  })
  it("returns null for non-objects", () => {
    expect(parseOverrides(null)).toBeNull()
    expect(parseOverrides("nope")).toBeNull()
  })
  it("drops non-string array entries", () => {
    expect(parseOverrides({ add: ["ok", 5, null], remove: "x" })).toEqual({ add: ["ok"], remove: [] })
  })
})
