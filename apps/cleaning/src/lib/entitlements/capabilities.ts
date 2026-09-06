// Capability catalog — the single source of truth for what the product can do.
//
// Product code gates features on these namespaced keys via canUse(); it must
// NEVER branch on the package tier directly (e.g. `if (org.packageTier ===
// "TEAM")`). Repackaging is done by editing the tier→capability map in
// packages.ts, with zero changes to product logic.

export const CAPABILITIES = [
  // ── Cleaning core (Solo and up) ──────────────────────────────────────────
  "core.customers",
  "core.locations",
  "core.checklists",
  "core.servicePlans",
  "core.scheduling",
  "core.jobs",
  "core.reporting.basic",

  // ── Workforce / FSM (Team and up) ────────────────────────────────────────
  "workforce.employees",
  "workforce.assignments",
  "workforce.mobileFieldApp",
  "workforce.timeTracking",
  "workforce.timesheetApproval",
  "workforce.geofencing", // architecture present; enforcement gated + off by default
  "quality.inspections",
  "operations.issues",
  "operations.correctiveActions",
  "workforce.payrollExport", // export/integration only — never payroll processing

  // ── ERP (Business and up) ────────────────────────────────────────────────
  "operations.escalations",
  "erp.advancedRoles",
  "erp.laborBudgets",
  "erp.siteProfitability",
  "procurement.purchaseOrders",
  "procurement.inventory",
  "core.reporting.advanced",

  // ── Enterprise ───────────────────────────────────────────────────────────
  "enterprise.branchesRegions",
  "enterprise.sso",
  "enterprise.rbacAdvanced",
  "enterprise.apiAccess",
  "enterprise.auditAdvanced",
] as const

export type Capability = (typeof CAPABILITIES)[number]

const CAPABILITY_SET: ReadonlySet<string> = new Set(CAPABILITIES)

/** Runtime guard — true if the string is a known capability key. */
export function isCapability(value: string): value is Capability {
  return CAPABILITY_SET.has(value)
}
