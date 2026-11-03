// Capability catalog — the single source of truth for what the product can do.
//
// Product code gates features on these namespaced keys via canUse(); it must
// NEVER branch on the package tier directly (e.g. `if (org.packageTier ===
// "TEAM")`). Repackaging is done by editing the tier→capability map in
// packages.ts, with zero changes to product logic.
//
// Customer-facing tier names map to the code tiers as:
//   SOLO → "Solo"   TEAM → "Essentials"   BUSINESS → "Professional"   ENTERPRISE → "Enterprise"
//
// Every key below gates a real, shipped feature EXCEPT the enterprise.* block,
// which is the (unbuilt) Enterprise roadmap — sold "contact sales" only, never
// advertised as existing. A capability that gates nothing is a trap for the
// next reader, so we do not keep label-only keys here (e.g. the former
// core.reporting.* keys were removed: the report pages gate on their own caps).

export const CAPABILITIES = [
  // ── Solo (SOLO and up) — a complete operating system for a 1–3 person company
  "core.customers",
  "core.locations",
  "core.checklists",
  "core.servicePlans",
  "core.scheduling",
  "core.jobs",
  "crm.estimates", // basic estimates: leads, line-item estimates, estimate→customer conversion
  "billing.invoicing", // invoices, payments, AR
  "billing.onlinePayments", // Stripe card/ACH payment links + portal pay
  "billing.salesTax", // jurisdiction tax rates + per-site/service taxability on invoices
  "billing.periodInvoicing", // flat-period (recurring) invoicing + auto-draft cron

  // ── Essentials (TEAM and up) — add a team: employees, field app, portal ────
  "workforce.employees",
  "workforce.assignments",
  "workforce.mobileFieldApp", // field app ACCESS (enforced at the field shell, not just declared)
  "workforce.timeTracking",
  "workforce.timesheetApproval",
  "workforce.coverage", // shift coverage: availability, callouts, reassignment
  "workforce.payrollExport", // export/integration only — never payroll processing
  "workforce.hiring", // job postings, applicants, convert-to-employee
  "workforce.notifications", // email/SMS notifications + per-user channel preferences
  "workforce.geofencing", // architecture present; enforcement gated + off by default (unlisted)
  "quality.inspections", // inspection program (whole — not split basic/advanced)
  "operations.issues", // issue lifecycle: ownership, routing, SLA, escalation, resolve/verify (whole)
  "operations.dataImport", // CSV import of customers/sites/contacts with preview + rollback
  "portal.customerAccess", // customer portal (CLIENT role, isolated) + customer issue reporting
  "integrations.exports", // QBO/Xero/Gusto/ADP CSV exports (no API)
  "billing.arAging", // accounts-receivable aging report

  // ── Professional (BUSINESS and up) — advanced workflows & ERP costing ──────
  "crm.bidCalculator", // production-rate commercial bid worksheet on estimates
  "crm.contracts", // service agreements / contracts
  "crm.quoting", // multi-channel quote intake (phone/online/in-person)
  "operations.sopLibrary", // SOP library: procedures, versioning, acknowledgment, section search
  "operations.workOrders", // billable one-time/extra work: manual-job rates, work orders, change orders
  "operations.serviceAreas", // service areas + do-not-serve exclusions
  "operations.accessControl", // key & access management (encrypted codes)
  "workforce.commissionPay", // commission / crew-based pay rules + earnings (export only)
  "workforce.laborCosting", // shift differentials + labor burden (costing/export only)
  "workforce.compliance", // employee credentials + site requirements
  "reporting.profitability", // site/customer/plan margin (pay-rate-derived)
  "erp.laborBudgets",
  "erp.siteProfitability",
  "assets.management", // asset register + maintenance log
  "supplies.inventory", // supply stock + usage log

  // ── Enterprise — roadmap only (contact sales; none of these are built yet) ─
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
