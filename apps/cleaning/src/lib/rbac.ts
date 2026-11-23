// Role-based access control — answers "WHO can reach this", independent of
// capabilities (which answer "WHAT the plan includes"). A nav item is shown
// only when BOTH the role permits the route AND the org has any capability the
// route requires. The two systems are deliberately orthogonal.

export const ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER", "CLIENT"] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

/** Management roles use the desktop ERP shell; cleaners use the field app. */
export const MANAGEMENT_ROLES: ReadonlySet<Role> = new Set<Role>([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
])

export type Experience = "admin" | "field"

/** Which experience a role belongs to. Cleaners never see the ERP shell. */
export function experienceForRole(role: string): Experience {
  return role === "CLEANER" ? "field" : "admin"
}

// ── Admin shell navigation ──────────────────────────────────────────────────
// `requiredCap` (optional) additionally gates the item behind a capability, so
// a lower package (e.g. Solo) simply drops it with no code change.

export type AdminNavItem = {
  key: string
  label: string
  href: string
  requiredCap?: string
  section?: string // optional group header rendered above the first item of a run
}

// Seven top-level workspaces group every destination. The `section` is the only
// thing that changed from the historical flat list — keys, hrefs and required
// capabilities are untouched, so role access and subscription gating are
// identical. Items are ordered so each section's members are contiguous (the
// sidebar prints a header above the first item of each run).
export const ADMIN_NAV: AdminNavItem[] = [
  // ── Overview ───────────────────────────────────────────────────────────────
  { key: "dashboard",   label: "Dashboard",   href: "/dashboard", section: "Overview" },

  // ── Operations ───────────────────────────────────────────────────────────────
  { key: "schedule",    label: "Schedule",    href: "/schedule",    requiredCap: "core.scheduling",       section: "Operations" },
  { key: "jobs",        label: "Jobs",        href: "/jobs",        requiredCap: "core.jobs",             section: "Operations" },
  { key: "service-requests", label: "Service requests", href: "/service-requests", requiredCap: "core.jobs", section: "Operations" },
  { key: "work-orders", label: "Work orders", href: "/work-orders", requiredCap: "operations.workOrders", section: "Operations" },
  { key: "inspections", label: "Inspections", href: "/inspections", requiredCap: "quality.inspections",   section: "Operations" },
  { key: "issues",      label: "Issues",      href: "/issues",      requiredCap: "operations.issues",     section: "Operations" },
  { key: "issues",      label: "Customer complaints", href: "/issues/complaints", requiredCap: "operations.issues", section: "Operations" },
  { key: "employee-reports", label: "Workplace reports", href: "/reports/employee", requiredCap: "operations.employeeReports", section: "Operations" },
  { key: "sops",        label: "SOPs",        href: "/sops",        requiredCap: "operations.sopLibrary", section: "Operations" },
  { key: "access",      label: "Access & keys", href: "/access",    requiredCap: "operations.accessControl", section: "Operations" },
  { key: "service-areas", label: "Service areas", href: "/service-areas", requiredCap: "operations.serviceAreas", section: "Operations" },

  // ── Customers ───────────────────────────────────────────────────────────────
  { key: "customers",   label: "Customers",   href: "/customers",   requiredCap: "core.customers",   section: "Customers" },
  { key: "locations",   label: "Locations",   href: "/locations",   requiredCap: "core.locations",   section: "Customers" },
  { key: "quotes",      label: "Quotes",      href: "/quotes",      requiredCap: "crm.quoting",      section: "Customers" },
  { key: "leads",       label: "Leads",       href: "/leads",       requiredCap: "crm.estimates",    section: "Customers" },
  { key: "estimates",   label: "Estimates",   href: "/estimates",   requiredCap: "crm.estimates",    section: "Customers" },
  { key: "contracts",   label: "Contracts",   href: "/contracts",   requiredCap: "crm.contracts",    section: "Customers" },

  // ── Workforce ───────────────────────────────────────────────────────────────
  { key: "team",        label: "Team",        href: "/team",        requiredCap: "workforce.employees",     section: "Workforce" },
  { key: "time",        label: "Time",        href: "/time",        requiredCap: "workforce.timeTracking",  section: "Workforce" },
  { key: "pay-periods", label: "Pay periods", href: "/time/periods", requiredCap: "workforce.payrollExport", section: "Workforce" },
  { key: "differentials", label: "Shift differentials", href: "/differentials", requiredCap: "workforce.laborCosting", section: "Workforce" },
  { key: "coverage",    label: "Coverage",    href: "/coverage",    requiredCap: "workforce.coverage",      section: "Workforce" },
  { key: "skills",      label: "Skills",      href: "/skills",      requiredCap: "workforce.coverage",      section: "Workforce" },
  { key: "kiosks",      label: "Kiosks",      href: "/kiosks",      requiredCap: "workforce.timeTracking",  section: "Workforce" },
  { key: "compliance",  label: "Compliance",  href: "/compliance",  requiredCap: "workforce.compliance",    section: "Workforce" },
  { key: "performance", label: "Performance", href: "/performance", requiredCap: "workforce.performanceAnalytics", section: "Workforce" },
  { key: "hiring",      label: "Hiring",      href: "/hiring",      requiredCap: "workforce.hiring",        section: "Workforce" },
  { key: "onboarding",  label: "Onboarding",  href: "/onboarding",  requiredCap: "workforce.hiring",        section: "Workforce" },

  // ── Finance ───────────────────────────────────────────────────────────────
  { key: "invoices",    label: "Invoices",    href: "/billing/invoices",    requiredCap: "billing.invoicing", section: "Finance" },
  { key: "payments",    label: "Payments",    href: "/billing/payments",    requiredCap: "billing.invoicing", section: "Finance" },
  { key: "ar-aging",    label: "AR Aging",    href: "/billing/ar-aging",    requiredCap: "billing.arAging",   section: "Finance" },
  { key: "tax",         label: "Sales tax",   href: "/billing/tax",         requiredCap: "billing.salesTax",  section: "Finance" },
  { key: "collections", label: "Collections", href: "/billing/collections", requiredCap: "billing.invoicing", section: "Finance" },

  // ── Analytics ───────────────────────────────────────────────────────────────
  { key: "profitability", label: "Profitability", href: "/reports/profitability", requiredCap: "reporting.profitability", section: "Analytics" },
  { key: "satisfaction", label: "Satisfaction", href: "/reports/satisfaction", requiredCap: "quality.inspections",      section: "Analytics" },
  { key: "supply-spend", label: "Supply spend", href: "/reports/supply-spend", requiredCap: "reporting.profitability",  section: "Analytics" },
  { key: "indirect-costs", label: "Indirect costs", href: "/reports/indirect-costs", requiredCap: "erp.siteProfitability", section: "Analytics" },
  { key: "labor-budgets", label: "Labor budgets", href: "/reports/labor-budgets", requiredCap: "erp.laborBudgets",       section: "Analytics" },

  // ── Administration ───────────────────────────────────────────────────────────
  { key: "exports",     label: "Exports",     href: "/exports",     requiredCap: "integrations.exports",  section: "Administration" },
  { key: "import",      label: "Import",      href: "/import",      requiredCap: "operations.dataImport", section: "Administration" },
  { key: "assets",      label: "Assets",      href: "/assets",      requiredCap: "assets.management",     section: "Administration" },
  { key: "supplies",    label: "Supplies",    href: "/supplies",    requiredCap: "supplies.inventory",    section: "Administration" },
  { key: "settings",    label: "Settings",    href: "/settings",    section: "Administration" },
]

/** The seven workspace sections, in sidebar order. */
export const NAV_SECTIONS = [
  "Overview", "Operations", "Customers", "Workforce", "Finance", "Analytics", "Administration",
] as const
export type NavSection = (typeof NAV_SECTIONS)[number]

/** All known admin route keys — used to scope middleware RBAC enforcement. */
export const ADMIN_ROUTE_KEYS: ReadonlySet<string> = new Set(ADMIN_NAV.map((i) => i.key))

// Route keys each role may access within the admin shell. "*" = all.
const ROLE_ROUTE_ACCESS: Record<Role, string[] | "*"> = {
  OWNER: "*",
  ADMIN: "*",
  MANAGER: ["dashboard", "schedule", "jobs", "customers", "locations", "team", "time", "pay-periods", "differentials", "coverage", "skills", "kiosks", "compliance", "access", "inspections", "issues", "employee-reports", "service-requests", "satisfaction", "service-areas", "quotes", "leads", "estimates", "contracts", "work-orders", "performance", "hiring", "onboarding", "invoices", "payments", "ar-aging", "tax", "collections", "profitability", "supply-spend", "indirect-costs", "labor-budgets", "exports", "import", "assets", "supplies"],
  SUPERVISOR: ["dashboard", "schedule", "jobs", "time", "inspections", "issues", "employee-reports", "service-requests"],
  CLEANER: [], // cleaners have no admin routes; they use the field app
  CLIENT: [], // portal users have NO admin routes; they live under /portal
}

/** True if the role may access the given admin route key (ignores capability). */
export function canAccessAdminRoute(role: string, routeKey: string): boolean {
  if (!isRole(role)) return false
  const access = ROLE_ROUTE_ACCESS[role]
  return access === "*" || access.includes(routeKey)
}

/** Nav items visible to a role, filtered by both RBAC and capability. */
export function navForRole(role: string, hasCapability: (cap: string) => boolean): AdminNavItem[] {
  return ADMIN_NAV.filter(
    (item) =>
      canAccessAdminRoute(role, item.key) &&
      (!item.requiredCap || hasCapability(item.requiredCap)),
  )
}

/** Where a freshly-authenticated user should land, by role. */
export function landingPathForRole(role: string): string {
  if (role === "CLIENT") return "/portal"
  return experienceForRole(role) === "field" ? "/today" : "/dashboard"
}

// Customer-account administration (customers, sites, scopes, service plans).
// Supervisors are intentionally excluded — they run operations, not accounts.
const ACCOUNT_MANAGEMENT_ROLES: ReadonlySet<Role> = new Set<Role>(["OWNER", "ADMIN", "MANAGER"])

/** True if the role may manage customer accounts, sites, scopes, and plans. */
export function canManageAccounts(role: string): boolean {
  return isRole(role) && ACCOUNT_MANAGEMENT_ROLES.has(role)
}

// Schedule/Jobs: managers write, supervisors read. Cleaners never (field app).
const SCHEDULE_READ_ROLES: ReadonlySet<Role> = new Set<Role>(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"])

/** True if the role may VIEW the schedule and jobs (managers + supervisors). */
export function canViewSchedule(role: string): boolean {
  return isRole(role) && SCHEDULE_READ_ROLES.has(role)
}

/** True if the role may CREATE/EDIT jobs, generate, and assign cleaners. */
export function canManageSchedule(role: string): boolean {
  return canManageAccounts(role)
}

/** Organization-level administration (timezone, billing, workspace settings). */
export function canManageOrg(role: string): boolean {
  return isRole(role) && (role === "OWNER" || role === "ADMIN")
}

// Inspections: supervisors perform QC alongside managers/admins.
export const INSPECTOR_ROLES: ReadonlySet<Role> = new Set<Role>(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"])

/** True if the role may perform and finalize inspections. */
export function canInspect(role: string): boolean {
  return isRole(role) && INSPECTOR_ROLES.has(role)
}

// Time approval/correction/export is payroll-sensitive and org-wide (we have no
// supervisor→team scoping yet), so it is Manager+ only — NOT supervisors.
export function canApproveTime(role: string): boolean {
  return canManageAccounts(role)
}

/** Who may manage the Team (create/edit users). Same set as account management. */
export function canManageTeam(role: string): boolean {
  return canManageAccounts(role)
}

/** Roles an actor may assign. Only OWNER/ADMIN may grant OWNER/ADMIN. */
export function assignableRoles(actorRole: string): Role[] {
  if (actorRole === "OWNER" || actorRole === "ADMIN") return ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"]
  if (actorRole === "MANAGER") return ["SUPERVISOR", "CLEANER"]
  return []
}
