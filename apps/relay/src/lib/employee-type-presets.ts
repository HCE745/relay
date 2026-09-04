import type { PageKey, ActionKey } from "./page-access"

export interface EmployeeTypePreset {
  key: string
  name: string
  description: string
  baseRole: string
  pageAccess: PageKey[]
  actions: ActionKey[]
  canInvite: boolean
  canChangeEmail: boolean
}

const ALL_PAGES: PageKey[] = [
  "dashboard", "issues", "archive", "calendar", "sops", "assets", "locations",
  "departments", "vendors", "team", "suggestions", "my-submissions",
  "purchase-requests", "injury-reports", "analytics",
]

const ALL_ACTIONS: ActionKey[] = [
  "can_manage_users", "can_approve_purchases", "can_manage_workflows",
  "can_edit_issues", "can_edit_assets", "can_manage_sops", "can_manage_vendors",
  "can_manage_departments", "can_manage_locations", "can_view_analytics",
]

export const EMPLOYEE_TYPE_PRESETS: EmployeeTypePreset[] = [
  {
    key: "basic_employee",
    name: "Basic Employee",
    description: "Standard access for frontline employees — can submit issues and suggestions.",
    baseRole: "EMPLOYEE",
    pageAccess: ["dashboard", "issues", "suggestions", "my-submissions", "archive"],
    actions: [],
    canInvite: false,
    canChangeEmail: true,
  },
  {
    key: "maintenance_technician",
    name: "Maintenance Technician",
    description: "Handles maintenance tasks — access to assets, SOPs, and issue reporting.",
    baseRole: "EMPLOYEE",
    pageAccess: ["dashboard", "issues", "assets", "sops", "my-submissions", "archive"],
    actions: ["can_edit_assets", "can_edit_issues"],
    canInvite: false,
    canChangeEmail: true,
  },
  {
    key: "maintenance_lead",
    name: "Maintenance Lead",
    description: "Leads maintenance operations — manages assets, vendors, and maintenance issues.",
    baseRole: "SUPERVISOR",
    pageAccess: ["dashboard", "issues", "assets", "sops", "vendors", "team", "calendar", "suggestions", "my-submissions", "archive"],
    actions: ["can_edit_assets", "can_manage_sops", "can_manage_vendors", "can_edit_issues"],
    canInvite: false,
    canChangeEmail: true,
  },
  {
    key: "supervisor",
    name: "Supervisor",
    description: "Frontline supervisor with team and safety oversight.",
    baseRole: "SUPERVISOR",
    pageAccess: ["dashboard", "issues", "calendar", "sops", "team", "suggestions", "my-submissions", "injury-reports", "archive"],
    actions: ["can_edit_issues", "can_manage_users"],
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "department_manager",
    name: "Department Manager",
    description: "Manages a specific department — full issue and team access within their scope.",
    baseRole: "MANAGER",
    pageAccess: ["dashboard", "issues", "calendar", "sops", "assets", "vendors", "team", "departments", "suggestions", "my-submissions", "injury-reports", "analytics", "archive"],
    actions: ["can_edit_issues", "can_manage_users", "can_manage_departments", "can_manage_sops", "can_manage_vendors", "can_edit_assets", "can_view_analytics"],
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "plant_manager",
    name: "Plant Manager / General Manager",
    description: "Full site access — unrestricted visibility and management of all operations.",
    baseRole: "MANAGER",
    pageAccess: ALL_PAGES,
    actions: ALL_ACTIONS,
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "regional_manager",
    name: "Regional Manager",
    description: "Oversees multiple locations — same access as Plant Manager, scoped to assigned locations.",
    baseRole: "MANAGER",
    pageAccess: ALL_PAGES,
    actions: ALL_ACTIONS,
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "safety_coordinator",
    name: "Safety Coordinator",
    description: "Oversees safety compliance, SOPs, and injury reporting.",
    baseRole: "SUPERVISOR",
    pageAccess: ["dashboard", "issues", "sops", "injury-reports", "analytics", "archive"],
    actions: ["can_manage_sops", "can_edit_issues", "can_view_analytics"],
    canInvite: false,
    canChangeEmail: true,
  },
  {
    key: "hr",
    name: "HR",
    description: "Human resources — team management, injury reporting, and analytics.",
    baseRole: "HR",
    pageAccess: ["dashboard", "team", "injury-reports", "suggestions", "analytics", "archive"],
    actions: ["can_manage_users", "can_view_analytics"],
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "purchasing_manager",
    name: "Purchasing Manager",
    description: "Manages procurement — approves purchases and oversees vendor relationships.",
    baseRole: "MANAGER",
    pageAccess: ["dashboard", "issues", "assets", "vendors", "purchase-requests", "analytics", "archive"],
    actions: ["can_approve_purchases", "can_edit_assets", "can_manage_vendors", "can_view_analytics"],
    canInvite: false,
    canChangeEmail: true,
  },
  {
    key: "administrator",
    name: "Administrator",
    description: "Full organizational access — unrestricted management of all pages and actions.",
    baseRole: "ADMIN",
    pageAccess: ALL_PAGES,
    actions: ALL_ACTIONS,
    canInvite: true,
    canChangeEmail: true,
  },
  // ── Professional Plus presets ───────────────────────────────────────────────
  {
    key: "corporate_executive",
    name: "Corporate Executive",
    description: "Read-only access to everything company-wide. No editing permissions.",
    baseRole: "MANAGER",
    pageAccess: ALL_PAGES,
    actions: ["can_view_analytics"],
    canInvite: false,
    canChangeEmail: false,
  },
  {
    key: "division_manager",
    name: "Division Manager",
    description: "Manages multiple departments across locations — full team and issue access.",
    baseRole: "MANAGER",
    pageAccess: ALL_PAGES,
    actions: ALL_ACTIONS,
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "corporate_administrator",
    name: "Corporate Administrator",
    description: "Enterprise-labeled full access equivalent to Administrator.",
    baseRole: "ADMIN",
    pageAccess: ALL_PAGES,
    actions: ALL_ACTIONS,
    canInvite: true,
    canChangeEmail: true,
  },
  {
    key: "facility_partner_user",
    name: "Facility Partner User",
    description: "Limited access for partner org users in shared facility — view and submit only.",
    baseRole: "EMPLOYEE",
    pageAccess: ["dashboard", "issues", "my-submissions"],
    actions: [],
    canInvite: false,
    canChangeEmail: false,
  },
  {
    key: "contractor_user",
    name: "Contractor User",
    description: "Submit issues only, view their own submissions — no access to internal data.",
    baseRole: "EMPLOYEE",
    pageAccess: ["my-submissions"],
    actions: [],
    canInvite: false,
    canChangeEmail: false,
  },
  {
    key: "tenant_user",
    name: "Tenant User",
    description: "Submit shared facility issues only, view own submissions — shared facility use.",
    baseRole: "EMPLOYEE",
    pageAccess: ["my-submissions"],
    actions: [],
    canInvite: false,
    canChangeEmail: false,
  },
]
