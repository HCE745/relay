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
  "operations.accessControl", // key & access management (encrypted codes)
  "operations.sopLibrary", // SOP library: procedures, versioning, acknowledgment, section search
  "workforce.payrollExport", // export/integration only — never payroll processing
  "workforce.commissionPay", // commission / crew-based pay rules + earnings (export only)
  "workforce.coverage", // shift coverage: availability, callouts, reassignment
  "billing.invoicing", // invoices, payments, AR
  "billing.periodInvoicing", // flat-period (recurring) invoicing + auto-draft cron
  "billing.arAging", // accounts-receivable aging report
  "integrations.exports", // QBO/Xero/Gusto/ADP CSV exports (no API)
  "portal.customerAccess", // customer portal (CLIENT role, isolated)
  "reporting.profitability", // site/customer/plan margin (pay-rate-derived)
  "crm.estimates", // leads, estimates, estimate→customer conversion
  "crm.contracts", // service agreements / contracts
  "crm.bidCalculator", // production-rate bid worksheet on estimates
  "crm.quoting", // multi-channel quote intake (phone/online/in-person)
  "workforce.hiring", // job postings, applicants, convert-to-employee
  "operations.serviceAreas", // service areas + do-not-serve exclusions
  "operations.workOrders", // billable one-time/extra work: manual-job rates, work orders, change orders
  "workforce.notifications", // email/SMS notifications + per-user channel preferences
  "billing.onlinePayments", // Stripe card/ACH payment links + portal pay
  "operations.dataImport", // CSV import of customers/sites/contacts with preview + rollback

  // ── ERP (Business and up) ────────────────────────────────────────────────
  "workforce.compliance", // employee credentials + site requirements (BUSINESS)
  "erp.advancedRoles",
  "erp.laborBudgets",
  "erp.siteProfitability",
  "assets.management", // asset register + maintenance log
  "supplies.inventory", // supply stock + usage log
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
