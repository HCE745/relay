// EXACT package matrix — the approved Solo / Essentials / Professional /
// Enterprise structure, pinned capability-by-capability.
//
// Unlike the inheritance test (which only proves each tier ⊇ the one below),
// this asserts the PRECISE set each tier grants. The expected adds below are a
// deliberate second copy of packages.ts: any move, add, or drop of a capability
// must be made in BOTH places, so an accidental or silent repackaging fails
// here loudly. This is the guarantee that we never sell what a tier doesn't
// grant — or grant what we didn't mean to sell.

import { describe, it, expect } from "vitest"
import { canUse } from "../can-use"
import { PACKAGE_CAPABILITIES, PACKAGE_ORDER, type PackageTier } from "../packages"
import { CAPABILITIES, isCapability, type Capability } from "../capabilities"

// What each tier ADDS on top of the tier below (customer-facing name in comment).
const ADDS: Record<PackageTier, Capability[]> = {
  // Solo ($49) — complete operating system for a 1–3 person company; it can bill.
  SOLO: [
    "core.customers",
    "core.locations",
    "core.checklists",
    "core.servicePlans",
    "core.scheduling",
    "core.jobs",
    "crm.estimates",
    "billing.invoicing",
    "billing.onlinePayments",
    "billing.salesTax",
    "billing.periodInvoicing",
  ],
  // Essentials ($99) — add a team.
  TEAM: [
    "workforce.employees",
    "workforce.assignments",
    "workforce.mobileFieldApp",
    "workforce.timeTracking",
    "workforce.timesheetApproval",
    "workforce.coverage",
    "workforce.payrollExport",
    "workforce.hiring",
    "workforce.notifications",
    "workforce.geofencing",
    "quality.inspections",
    "operations.issues",
    "operations.dataImport",
    "portal.customerAccess",
    "integrations.exports",
    "billing.arAging",
  ],
  // Professional ($199) — advanced workflows + ERP costing.
  BUSINESS: [
    "crm.bidCalculator",
    "crm.contracts",
    "crm.quoting",
    "operations.sopLibrary",
    "operations.workOrders",
    "operations.serviceAreas",
    "operations.accessControl",
    "workforce.commissionPay",
    "workforce.laborCosting",
    "workforce.compliance",
    "reporting.profitability",
    "erp.laborBudgets",
    "erp.siteProfitability",
    "assets.management",
    "supplies.inventory",
  ],
  // Enterprise — roadmap only (contact sales).
  ENTERPRISE: [
    "enterprise.branchesRegions",
    "enterprise.sso",
    "enterprise.rbacAdvanced",
    "enterprise.apiAccess",
    "enterprise.auditAdvanced",
  ],
}

// Cumulative expected set per tier, built from ADDS (inheritance applied here).
function expectedFor(tier: PackageTier): Set<Capability> {
  const out = new Set<Capability>()
  for (const t of PACKAGE_ORDER) {
    for (const cap of ADDS[t]) out.add(cap)
    if (t === tier) break
  }
  return out
}

describe("exact package matrix", () => {
  for (const tier of PACKAGE_ORDER) {
    it(`${tier} grants EXACTLY its expected capability set`, () => {
      const actual = PACKAGE_CAPABILITIES[tier]
      const expected = expectedFor(tier)
      // Same size, and set-equal in both directions (no missing, no extra).
      expect(actual.size).toBe(expected.size)
      for (const cap of expected) expect(actual.has(cap)).toBe(true)
      for (const cap of actual) expect(expected.has(cap)).toBe(true)
    })
  }

  it("every ADD is unique across tiers (no capability placed in two tiers)", () => {
    const seen = new Set<string>()
    for (const tier of PACKAGE_ORDER) {
      for (const cap of ADDS[tier]) {
        expect(seen.has(cap)).toBe(false)
        seen.add(cap)
      }
    }
  })

  it("the tiers partition the WHOLE catalog — no orphan capability sits in no tier", () => {
    const placed = new Set<string>()
    for (const tier of PACKAGE_ORDER) for (const cap of ADDS[tier]) placed.add(cap)
    for (const cap of CAPABILITIES) expect(placed.has(cap)).toBe(true)
    expect(placed.size).toBe(CAPABILITIES.length)
  })
})

describe("decision guarantees (D1–D3, D-a…D-g)", () => {
  it("Solo can bill — invoicing and online payments are in SOLO", () => {
    expect(canUse({ packageTier: "SOLO" }, "billing.invoicing")).toBe(true)
    expect(canUse({ packageTier: "SOLO" }, "billing.onlinePayments")).toBe(true)
    expect(canUse({ packageTier: "SOLO" }, "billing.salesTax")).toBe(true)
    expect(canUse({ packageTier: "SOLO" }, "billing.periodInvoicing")).toBe(true)
  })

  it("Solo keeps basic estimates but NOT the commercial bid calculator (clean split)", () => {
    expect(canUse({ packageTier: "SOLO" }, "crm.estimates")).toBe(true)
    expect(canUse({ packageTier: "SOLO" }, "crm.bidCalculator")).toBe(false)
    expect(canUse({ packageTier: "BUSINESS" }, "crm.bidCalculator")).toBe(true)
  })

  it("Solo does NOT get the field app or portal — those begin at Essentials (D-c, D-d)", () => {
    expect(canUse({ packageTier: "SOLO" }, "workforce.mobileFieldApp")).toBe(false)
    expect(canUse({ packageTier: "SOLO" }, "workforce.employees")).toBe(false)
    expect(canUse({ packageTier: "SOLO" }, "portal.customerAccess")).toBe(false)
    expect(canUse({ packageTier: "TEAM" }, "workforce.mobileFieldApp")).toBe(true)
    expect(canUse({ packageTier: "TEAM" }, "portal.customerAccess")).toBe(true)
  })

  it("issues and inspections are WHOLE at Essentials — no sub-caps, no Professional split (D-d, D-e)", () => {
    expect(canUse({ packageTier: "TEAM" }, "operations.issues")).toBe(true)
    expect(canUse({ packageTier: "TEAM" }, "quality.inspections")).toBe(true)
    // Work orders remain Professional (the one piece that was already separable).
    expect(canUse({ packageTier: "TEAM" }, "operations.workOrders")).toBe(false)
    expect(canUse({ packageTier: "BUSINESS" }, "operations.workOrders")).toBe(true)
  })

  it("advanced workflows + ERP costing are Professional, not Essentials", () => {
    for (const cap of [
      "operations.sopLibrary",
      "crm.contracts",
      "workforce.compliance",
      "reporting.profitability",
      "erp.laborBudgets",
      "assets.management",
      "supplies.inventory",
    ] as const) {
      expect(canUse({ packageTier: "TEAM" }, cap)).toBe(false)
      expect(canUse({ packageTier: "BUSINESS" }, cap)).toBe(true)
    }
  })

  it("Enterprise roadmap caps gate nothing below Enterprise (contact-sales only)", () => {
    for (const cap of [
      "enterprise.branchesRegions",
      "enterprise.sso",
      "enterprise.rbacAdvanced",
      "enterprise.apiAccess",
      "enterprise.auditAdvanced",
    ] as const) {
      expect(canUse({ packageTier: "BUSINESS" }, cap)).toBe(false)
      expect(canUse({ packageTier: "ENTERPRISE" }, cap)).toBe(true)
    }
  })

  it("removed label-only caps are gone from the catalog entirely", () => {
    for (const dead of ["core.reporting.basic", "core.reporting.advanced", "erp.advancedRoles"]) {
      expect(isCapability(dead)).toBe(false)
      expect(CAPABILITIES).not.toContain(dead as never)
    }
  })
})
