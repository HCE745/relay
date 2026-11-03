// Package → capability mapping, defined as strict inheritance:
//   SOLO ⊂ TEAM ⊂ BUSINESS ⊂ ENTERPRISE
//
// Customer-facing names: SOLO="Solo" ($49), TEAM="Essentials" ($99),
// BUSINESS="Professional" ($199), ENTERPRISE="Enterprise" (contact sales).
//
// Each higher tier spreads the tier below it and adds its own capabilities, so
// inheritance is guaranteed by construction (and asserted in tests). Employee
// counts are advisory; a company on any tier gets exactly this tier's set,
// adjusted by per-org overrides in can-use.ts.
//
// Principle: gate advanced workflows, not essential operations. Basic estimates,
// invoicing, online payments and checklists stay in Solo — "a tier that cannot
// bill is not a product". Teams (employees, field app, portal, time tracking,
// whole issue/inspection management) start at Essentials. Advanced workflows
// (commercial bidding, contracts, SOPs, work orders, profitability, compliance,
// ERP costing, assets, supplies) are Professional.

import type { Capability } from "./capabilities"

export type PackageTier = "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE"

// Solo — a complete operating system for a 1–3 person owner-operator. Mobile
// access here is the responsive admin web; the cleaner FIELD app begins at
// Essentials, since it requires workforce.employees (you can't staff jobs solo).
const SOLO_CAPS: Capability[] = [
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
]

// Essentials — "you have a team now": employees, the field app, the customer
// portal, time, coverage, payroll exports, data import, and the WHOLE issue and
// inspection systems (not split — a working lifecycle is not cut to fit a price).
const TEAM_CAPS: Capability[] = [
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
]

// Professional — advanced workflows and ERP costing on top of a running team.
const BUSINESS_CAPS: Capability[] = [
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
]

// Enterprise — roadmap only; none of these are implemented. Sold "contact
// sales", never advertised as existing. Build multi-branch post-launch, and
// only when a real prospect asks.
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
