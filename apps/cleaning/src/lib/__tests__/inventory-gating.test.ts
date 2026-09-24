import { describe, it, expect } from "vitest"
import { Prisma } from "../../generated/prisma/client"
import { navForRole } from "../rbac"
import { capabilitiesForTier } from "../entitlements/packages"
import { isLowStock } from "../data/supplies"

const team = capabilitiesForTier("TEAM")
const business = capabilitiesForTier("BUSINESS")
const navKeys = (role: string, caps: ReadonlySet<string>) => navForRole(role, (c) => caps.has(c)).map((i) => i.key)

describe("assets & supplies are BUSINESS-tier — hidden on TEAM", () => {
  it("a TEAM org sees no Assets/Supplies nav (hidden, not locked)", () => {
    const keys = navKeys("OWNER", team)
    expect(keys).not.toContain("assets")
    expect(keys).not.toContain("supplies")
  })
  it("capabilities are absent from the TEAM set entirely", () => {
    expect(team.has("assets.management" as never)).toBe(false)
    expect(team.has("supplies.inventory" as never)).toBe(false)
  })
  it("a BUSINESS org exposes Assets/Supplies to OWNER, ADMIN and MANAGER", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"]) {
      const keys = navKeys(role, business)
      expect(keys).toContain("assets")
      expect(keys).toContain("supplies")
    }
  })
  it("even on BUSINESS, a SUPERVISOR never sees them (route access)", () => {
    const keys = navKeys("SUPERVISOR", business)
    expect(keys).not.toContain("assets")
    expect(keys).not.toContain("supplies")
  })
})

describe("isLowStock", () => {
  const d = (v: string) => new Prisma.Decimal(v)
  it("flags at or below a meaningful reorder threshold", () => {
    expect(isLowStock({ currentStock: d("2"), reorderThreshold: d("5") })).toBe(true)
    expect(isLowStock({ currentStock: d("5"), reorderThreshold: d("5") })).toBe(true) // at threshold
    expect(isLowStock({ currentStock: d("6"), reorderThreshold: d("5") })).toBe(false)
  })
  it("a zero threshold means 'no reorder point' — never low", () => {
    expect(isLowStock({ currentStock: d("0"), reorderThreshold: d("0") })).toBe(false)
  })
})
