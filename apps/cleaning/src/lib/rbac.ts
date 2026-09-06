// Role-based access control — answers "WHO can reach this", independent of
// capabilities (which answer "WHAT the plan includes"). A nav item is shown
// only when BOTH the role permits the route AND the org has any capability the
// route requires. The two systems are deliberately orthogonal.

export const ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"] as const
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
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard",   label: "Dashboard",   href: "/dashboard" },
  { key: "schedule",    label: "Schedule",    href: "/schedule",    requiredCap: "core.scheduling" },
  { key: "jobs",        label: "Jobs",        href: "/jobs",        requiredCap: "core.jobs" },
  { key: "customers",   label: "Customers",   href: "/customers",   requiredCap: "core.customers" },
  { key: "locations",   label: "Locations",   href: "/locations",   requiredCap: "core.locations" },
  { key: "team",        label: "Team",        href: "/team",        requiredCap: "workforce.employees" },
  { key: "time",        label: "Time",        href: "/time",        requiredCap: "workforce.timeTracking" },
  { key: "inspections", label: "Inspections", href: "/inspections", requiredCap: "quality.inspections" },
  { key: "issues",      label: "Issues",      href: "/issues",      requiredCap: "operations.issues" },
  { key: "reports",     label: "Reports",     href: "/reports",     requiredCap: "core.reporting.basic" },
  { key: "settings",    label: "Settings",    href: "/settings" },
]

/** All known admin route keys — used to scope middleware RBAC enforcement. */
export const ADMIN_ROUTE_KEYS: ReadonlySet<string> = new Set(ADMIN_NAV.map((i) => i.key))

// Route keys each role may access within the admin shell. "*" = all.
const ROLE_ROUTE_ACCESS: Record<Role, string[] | "*"> = {
  OWNER: "*",
  ADMIN: "*",
  MANAGER: ["dashboard", "schedule", "jobs", "customers", "locations", "team", "time", "inspections", "issues", "reports"],
  SUPERVISOR: ["dashboard", "schedule", "jobs", "time", "inspections", "issues"],
  CLEANER: [], // cleaners have no admin routes; they use the field app
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
