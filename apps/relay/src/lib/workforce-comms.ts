import "server-only"
import { prisma } from "@/lib/prisma"
import {
  type OrgWCFlags,
  ALL_WC_FLAGS,
  type AnnouncementScopeOption,
} from "@/lib/workforce-comms-meta"

// Re-export everything the rest of the app needs from one import path.
export type { OrgWCFlags, AnnouncementScopeOption }
export { ALL_WC_FLAGS } from "@/lib/workforce-comms-meta"
export {
  WC_FLAG_PLAN,
  WC_FLAG_LABELS,
  WC_FLAG_DESCRIPTIONS,
} from "@/lib/workforce-comms-meta"
export type { AnnouncementScopeValue } from "@/lib/workforce-comms-meta"

// ─── Flag sets per tier ──────────────────────────────────────────────────────

const ESSENTIALS_FLAGS = new Set<keyof OrgWCFlags>([
  "wc_personal_inbox",
  "wc_individual_assignments",
  "wc_basic_notifications",
  "wc_basic_announcements",
  "wc_company_announcements",
  "wc_personal_reminders",
  "wc_push_notifications",
  "wc_email_notifications",
  "wc_inapp_notifications",
  "wc_basic_daily_briefing",
  "wc_announcement_history_readonly",
])

const PROFESSIONAL_FLAGS = new Set<keyof OrgWCFlags>([
  ...ESSENTIALS_FLAGS,
  "wc_department_announcements",
  "wc_team_announcements",
  "wc_shift_announcements",
  "wc_emergency_broadcasts",
  "wc_assignment_management",
  "wc_assignment_comments",
  "wc_assignment_attachments",
  "wc_assignment_history",
  "wc_announcement_acknowledgements",
  "wc_ai_daily_briefing",
  "wc_manager_announcement_dashboard",
  "wc_supervisor_tools",
  "wc_communication_search",
  "wc_inbox_filters",
  "wc_notification_preferences",
  "wc_department_communication_permissions",
])

const PROFESSIONAL_PLUS_FLAGS = new Set<keyof OrgWCFlags>([
  ...PROFESSIONAL_FLAGS,
  "wc_multi_location_announcements",
  "wc_regional_announcements",
  "wc_executive_announcements",
  "wc_org_wide_broadcasts",
  "wc_cross_location_communication",
  "wc_communication_analytics",
  "wc_announcement_reporting",
  "wc_read_rate_analytics",
  "wc_executive_communication_dashboard",
  "wc_ai_communication_summaries",
  "wc_ai_announcement_drafting",
  "wc_org_wide_assignment_management",
  "wc_cross_location_assignment_visibility",
  "wc_advanced_notification_rules",
  "wc_executive_daily_briefings",
])

const ENTERPRISE_FLAGS = new Set<keyof OrgWCFlags>([
  ...PROFESSIONAL_PLUS_FLAGS,
  "wc_sms_gateway",
  "wc_custom_notification_providers",
  "wc_custom_escalation_policies",
  "wc_compliance_logging",
  "wc_advanced_audit_history",
  "wc_api_access_communications",
  "wc_white_label_communications",
  "wc_enterprise_communication_controls",
])

// ─── Tier selector ───────────────────────────────────────────────────────────

function getFlagSetForPlan(plan: string): Set<keyof OrgWCFlags> {
  switch (plan) {
    case "enterprise":
      return ENTERPRISE_FLAGS
    case "professional_plus":
      return PROFESSIONAL_PLUS_FLAGS
    case "professional":
    case "pro":
    case "custom":
    case "starter":
      return PROFESSIONAL_FLAGS
    case "essentials":
    default:
      return ESSENTIALS_FLAGS
  }
}

// ─── Core function: set flags for a plan ─────────────────────────────────────

/**
 * Set all Workforce Communications feature flags for an org based on its plan tier.
 *
 * To add a new feature to the package structure:
 *   1. Add the Boolean field to prisma/schema.prisma with @default(false)
 *   2. Add the key to OrgWCFlags interface and ALL_WC_FLAGS in workforce-comms-meta.ts
 *   3. Add the key to the correct tier Set above
 *   4. Add labels/descriptions to WC_FLAG_LABELS and WC_FLAG_DESCRIPTIONS in workforce-comms-meta.ts
 *   5. Check the flag in the UI where the feature is rendered
 * No other changes to the package structure are required.
 */
export async function setWorkforceCommsPlanFlags(orgId: string, plan: string): Promise<void> {
  const enabledFlags = getFlagSetForPlan(plan)
  const data: Record<string, boolean> = {}
  for (const flag of ALL_WC_FLAGS) {
    data[flag] = enabledFlags.has(flag)
  }
  await prisma.organization.update({ where: { id: orgId }, data })
}

// ─── Getter ──────────────────────────────────────────────────────────────────

const WC_SELECT = Object.fromEntries(ALL_WC_FLAGS.map(f => [f, true])) as Record<keyof OrgWCFlags, true>

export async function getOrgWCFlags(orgId: string): Promise<OrgWCFlags | null> {
  return prisma.organization.findUnique({
    where:  { id: orgId },
    select: WC_SELECT,
  }) as Promise<OrgWCFlags | null>
}

// ─── Scope options for announcement creation based on plan ───────────────────

const ALL_SCOPE_OPTIONS: AnnouncementScopeOption[] = [
  { value: "org",        label: "Entire organization" },
  { value: "location",   label: "Specific location" },
  { value: "region",     label: "Region" },
  { value: "department", label: "Specific department" },
  { value: "team",       label: "Specific team" },
  { value: "individual", label: "Individual person" },
]

export function getScopeOptionsForPlan(plan: string): AnnouncementScopeOption[] {
  if (plan === "professional_plus" || plan === "enterprise") {
    return ALL_SCOPE_OPTIONS
  }
  if (getFlagSetForPlan(plan).has("wc_department_announcements")) {
    // Professional: org, department, team, individual
    return ALL_SCOPE_OPTIONS.filter(o => !["location", "region"].includes(o.value))
  }
  // Essentials: org only
  return ALL_SCOPE_OPTIONS.filter(o => o.value === "org")
}
