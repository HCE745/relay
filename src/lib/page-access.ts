// Shared page-access constants — safe to import from both client and server

export const CONFIGURABLE_PAGES = [
  { key: "dashboard",              label: "Dashboard" },
  { key: "issues",                 label: "Issues" },
  { key: "assignments",            label: "Assignments" },
  { key: "communications",         label: "Communications" },
  { key: "archive",                label: "Archive" },
  { key: "calendar",               label: "Calendar" },
  { key: "sops",                   label: "SOPs" },
  { key: "assets",                 label: "Assets" },
  { key: "locations",              label: "Locations" },
  { key: "departments",            label: "Departments" },
  { key: "vendors",                label: "Vendors" },
  { key: "team",                   label: "Team" },
  { key: "suggestions",            label: "Suggestions" },
  { key: "my-submissions",         label: "My Submissions" },
  { key: "purchase-requests",      label: "Purchase Requests" },
  { key: "approval-intelligence",  label: "Approval Intelligence" },
  { key: "injury-reports",         label: "Injury Reports" },
  { key: "analytics",              label: "Analytics" },
  { key: "qr-codes",               label: "QR Codes" },
  { key: "corporate-dashboard",    label: "Corporate Dashboard" },
  { key: "regional-dashboard",     label: "Regional Dashboard" },
] as const

export type PageKey = (typeof CONFIGURABLE_PAGES)[number]["key"]

export const CONFIGURABLE_ACTIONS = [
  { key: "can_manage_users",       label: "Manage Users",        description: "Invite, edit roles, and deactivate team members" },
  { key: "can_approve_purchases",  label: "Approve Purchases",   description: "Approve or reject purchase requests" },
  { key: "can_manage_workflows",   label: "Manage Workflows",    description: "Create and edit routing rules and escalation policies" },
  { key: "can_edit_issues",        label: "Edit & Close Issues", description: "Update, reassign, and resolve any issue" },
  { key: "can_edit_assets",        label: "Edit Assets",         description: "Create, update, and remove asset records" },
  { key: "can_manage_sops",        label: "Manage SOPs",         description: "Create, edit, and deactivate SOPs" },
  { key: "can_manage_vendors",     label: "Manage Vendors",      description: "Add and edit vendor records" },
  { key: "can_manage_departments", label: "Manage Departments",  description: "Create and edit department records" },
  { key: "can_manage_locations",   label: "Manage Locations",    description: "Create and edit location records" },
  { key: "can_view_analytics",     label: "View Analytics",      description: "Access reports and analytics dashboards" },
] as const

export type ActionKey = (typeof CONFIGURABLE_ACTIONS)[number]["key"]

// Roles that admins can configure (not ADMIN itself — always full access)
export const CONFIGURABLE_ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "HR", "VENDOR"] as const

// Default page access per role — used when no custom config is stored
export const DEFAULT_ACCESS: Record<string, PageKey[]> = {
  ADMIN:      ["dashboard", "issues", "assignments", "communications", "archive", "calendar", "sops", "assets", "qr-codes", "locations", "departments", "vendors", "team", "suggestions", "my-submissions", "purchase-requests", "approval-intelligence", "injury-reports", "analytics", "corporate-dashboard", "regional-dashboard"],
  HR:         ["dashboard", "assignments", "communications", "team", "injury-reports", "suggestions", "my-submissions", "analytics", "archive"],
  MANAGER:    ["dashboard", "issues", "assignments", "communications", "archive", "calendar", "sops", "assets", "qr-codes", "departments", "vendors", "team", "suggestions", "my-submissions", "purchase-requests", "approval-intelligence", "injury-reports", "analytics", "corporate-dashboard", "regional-dashboard"],
  SUPERVISOR: ["dashboard", "issues", "assignments", "communications", "archive", "calendar", "sops", "team", "suggestions", "my-submissions", "purchase-requests", "injury-reports"],
  EMPLOYEE:   ["dashboard", "assignments", "communications", "suggestions", "my-submissions", "purchase-requests"],
  VENDOR:     ["my-submissions"],
}

// Pages that cannot be removed for a given role
export const ALWAYS_ON: Partial<Record<string, PageKey[]>> = {
  EMPLOYEE: ["my-submissions"],
  VENDOR:   ["my-submissions"],
}

export type PageAccessConfig = Partial<Record<string, PageKey[]>>

// Returns the list of page keys the given role is allowed to see
export function getAccessConfig(role: string, storedConfig: PageAccessConfig | null): PageKey[] {
  if (role === "ADMIN") return DEFAULT_ACCESS["ADMIN"] ?? []
  if (storedConfig && Array.isArray(storedConfig[role])) {
    return storedConfig[role]!
  }
  return DEFAULT_ACCESS[role] ?? (["my-submissions"] as PageKey[])
}
