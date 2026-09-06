// Package → capability mapping, defined as strict inheritance:
//   SOLO ⊂ TEAM ⊂ BUSINESS ⊂ ENTERPRISE
//
// Each higher tier spreads the tier below it and adds its own capabilities, so
// inheritance is guaranteed by construction (and asserted in tests). Employee
// counts are advisory; a company on any tier gets exactly this tier's set,
// adjusted by per-org overrides in can-use.ts.

import type { Capability } from "./capabilities"

export type PackageTier = "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE"

const SOLO_CAPS: Capability[] = [
  "core.customers",
  "core.locations",
  "core.checklists",
  "core.servicePlans",
  "core.scheduling",
  "core.jobs",
  "core.reporting.basic",
]

const TEAM_CAPS: Capability[] = [
  "workforce.employees",
  "workforce.assignments",
  "workforce.mobileFieldApp",
  "workforce.timeTracking",
  "workforce.timesheetApproval",
  "workforce.geofencing",
  "quality.inspections",
  "operations.issues",
  "operations.correctiveActions",
  "workforce.payrollExport",
]

const BUSINESS_CAPS: Capability[] = [
  "operations.escalations",
  "erp.advancedRoles",
  "erp.laborBudgets",
  "erp.siteProfitability",
  "procurement.purchaseOrders",
  "procurement.inventory",
  "core.reporting.advanced",
]

const ENTERPRISE_CAPS: Capability[] = [
  "enterprise.branchesRegions",
  "enterprise.sso",
  "enterprise.rbacAdvanced",
  "enterprise.apiAccess",
  "enterprise.auditAdvanced",
]

const SOLO = new Set<Capability>(SOLO_CAPS)
const TEAM = new Set<Capability>([...SOLO, ...TEAM_CAPS])
const BUSINESS = new Set<Capability>([...TEAM, ...BUSINESS_CAPS])
const ENTERPRISE = new Set<Capability>([...BUSINESS, ...ENTERPRISE_CAPS])

export const PACKAGE_CAPABILITIES: Record<PackageTier, ReadonlySet<Capability>> = {
  SOLO,
  TEAM,
  BUSINESS,
  ENTERPRISE,
}

export const PACKAGE_ORDER: PackageTier[] = ["SOLO", "TEAM", "BUSINESS", "ENTERPRISE"]

/** The base capability set granted by a tier, before per-org overrides. */
export function capabilitiesForTier(tier: PackageTier): ReadonlySet<Capability> {
  return PACKAGE_CAPABILITIES[tier]
}
