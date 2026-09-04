// Client-safe constants and types for Workforce Communications feature flags.
// Do NOT add server-only imports here — this file is imported by client components.

export interface OrgWCFlags {
  // Essentials
  wc_personal_inbox:                       boolean
  wc_individual_assignments:               boolean
  wc_basic_notifications:                  boolean
  wc_basic_announcements:                  boolean
  wc_company_announcements:                boolean
  wc_personal_reminders:                   boolean
  wc_push_notifications:                   boolean
  wc_email_notifications:                  boolean
  wc_inapp_notifications:                  boolean
  wc_basic_daily_briefing:                 boolean
  wc_announcement_history_readonly:        boolean
  // Professional
  wc_department_announcements:             boolean
  wc_team_announcements:                   boolean
  wc_shift_announcements:                  boolean
  wc_emergency_broadcasts:                 boolean
  wc_assignment_management:                boolean
  wc_assignment_comments:                  boolean
  wc_assignment_attachments:               boolean
  wc_assignment_history:                   boolean
  wc_announcement_acknowledgements:        boolean
  wc_ai_daily_briefing:                    boolean
  wc_manager_announcement_dashboard:       boolean
  wc_supervisor_tools:                     boolean
  wc_communication_search:                 boolean
  wc_inbox_filters:                        boolean
  wc_notification_preferences:             boolean
  wc_department_communication_permissions: boolean
  // Professional Plus
  wc_multi_location_announcements:         boolean
  wc_regional_announcements:               boolean
  wc_executive_announcements:              boolean
  wc_org_wide_broadcasts:                  boolean
  wc_cross_location_communication:         boolean
  wc_communication_analytics:              boolean
  wc_announcement_reporting:               boolean
  wc_read_rate_analytics:                  boolean
  wc_executive_communication_dashboard:    boolean
  wc_ai_communication_summaries:           boolean
  wc_ai_announcement_drafting:             boolean
  wc_org_wide_assignment_management:       boolean
  wc_cross_location_assignment_visibility: boolean
  wc_advanced_notification_rules:          boolean
  wc_executive_daily_briefings:            boolean
  // Enterprise
  wc_sms_gateway:                          boolean
  wc_custom_notification_providers:        boolean
  wc_custom_escalation_policies:           boolean
  wc_compliance_logging:                   boolean
  wc_advanced_audit_history:               boolean
  wc_api_access_communications:            boolean
  wc_white_label_communications:           boolean
  wc_enterprise_communication_controls:    boolean
}

export const ALL_WC_FLAGS: (keyof OrgWCFlags)[] = [
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
  "wc_sms_gateway",
  "wc_custom_notification_providers",
  "wc_custom_escalation_policies",
  "wc_compliance_logging",
  "wc_advanced_audit_history",
  "wc_api_access_communications",
  "wc_white_label_communications",
  "wc_enterprise_communication_controls",
]

export const WC_FLAG_PLAN: Record<keyof OrgWCFlags, "essentials" | "professional" | "professional_plus" | "enterprise"> = {
  wc_personal_inbox:                       "essentials",
  wc_individual_assignments:               "essentials",
  wc_basic_notifications:                  "essentials",
  wc_basic_announcements:                  "essentials",
  wc_company_announcements:                "essentials",
  wc_personal_reminders:                   "essentials",
  wc_push_notifications:                   "essentials",
  wc_email_notifications:                  "essentials",
  wc_inapp_notifications:                  "essentials",
  wc_basic_daily_briefing:                 "essentials",
  wc_announcement_history_readonly:        "essentials",
  wc_department_announcements:             "professional",
  wc_team_announcements:                   "professional",
  wc_shift_announcements:                  "professional",
  wc_emergency_broadcasts:                 "professional",
  wc_assignment_management:                "professional",
  wc_assignment_comments:                  "professional",
  wc_assignment_attachments:               "professional",
  wc_assignment_history:                   "professional",
  wc_announcement_acknowledgements:        "professional",
  wc_ai_daily_briefing:                    "professional",
  wc_manager_announcement_dashboard:       "professional",
  wc_supervisor_tools:                     "professional",
  wc_communication_search:                 "professional",
  wc_inbox_filters:                        "professional",
  wc_notification_preferences:             "professional",
  wc_department_communication_permissions: "professional",
  wc_multi_location_announcements:         "professional_plus",
  wc_regional_announcements:               "professional_plus",
  wc_executive_announcements:              "professional_plus",
  wc_org_wide_broadcasts:                  "professional_plus",
  wc_cross_location_communication:         "professional_plus",
  wc_communication_analytics:              "professional_plus",
  wc_announcement_reporting:               "professional_plus",
  wc_read_rate_analytics:                  "professional_plus",
  wc_executive_communication_dashboard:    "professional_plus",
  wc_ai_communication_summaries:           "professional_plus",
  wc_ai_announcement_drafting:             "professional_plus",
  wc_org_wide_assignment_management:       "professional_plus",
  wc_cross_location_assignment_visibility: "professional_plus",
  wc_advanced_notification_rules:          "professional_plus",
  wc_executive_daily_briefings:            "professional_plus",
  wc_sms_gateway:                          "enterprise",
  wc_custom_notification_providers:        "enterprise",
  wc_custom_escalation_policies:           "enterprise",
  wc_compliance_logging:                   "enterprise",
  wc_advanced_audit_history:               "enterprise",
  wc_api_access_communications:            "enterprise",
  wc_white_label_communications:           "enterprise",
  wc_enterprise_communication_controls:    "enterprise",
}

export const WC_FLAG_LABELS: Record<keyof OrgWCFlags, string> = {
  wc_personal_inbox:                       "Personal Inbox",
  wc_individual_assignments:               "Individual Assignments",
  wc_basic_notifications:                  "Basic Notifications",
  wc_basic_announcements:                  "Basic Announcements",
  wc_company_announcements:                "Company-wide Announcements",
  wc_personal_reminders:                   "Personal Reminders",
  wc_push_notifications:                   "Push Notifications",
  wc_email_notifications:                  "Email Notifications",
  wc_inapp_notifications:                  "In-app Notifications",
  wc_basic_daily_briefing:                 "Basic Daily Briefing",
  wc_announcement_history_readonly:        "Announcement History (read-only)",
  wc_department_announcements:             "Department Announcements",
  wc_team_announcements:                   "Team Announcements",
  wc_shift_announcements:                  "Shift Announcements",
  wc_emergency_broadcasts:                 "Emergency Broadcasts",
  wc_assignment_management:                "Assignment Management",
  wc_assignment_comments:                  "Assignment Comments",
  wc_assignment_attachments:               "Assignment Attachments",
  wc_assignment_history:                   "Assignment Status History",
  wc_announcement_acknowledgements:        "Announcement Acknowledgements",
  wc_ai_daily_briefing:                    "AI-Generated Daily Briefing",
  wc_manager_announcement_dashboard:       "Manager Announcement Dashboard",
  wc_supervisor_tools:                     "Supervisor Tools",
  wc_communication_search:                 "Communication Search",
  wc_inbox_filters:                        "Inbox Filters",
  wc_notification_preferences:             "Notification Preferences",
  wc_department_communication_permissions: "Department Communication Permissions",
  wc_multi_location_announcements:         "Multi-Location Announcements",
  wc_regional_announcements:               "Regional Announcements",
  wc_executive_announcements:              "Executive Announcements",
  wc_org_wide_broadcasts:                  "Organization-wide Broadcasts",
  wc_cross_location_communication:         "Cross-Location Communication",
  wc_communication_analytics:              "Communication Analytics",
  wc_announcement_reporting:               "Announcement Reporting",
  wc_read_rate_analytics:                  "Read Rate Analytics",
  wc_executive_communication_dashboard:    "Executive Communication Dashboard",
  wc_ai_communication_summaries:           "AI Communication Summaries",
  wc_ai_announcement_drafting:             "AI Announcement Drafting",
  wc_org_wide_assignment_management:       "Org-wide Assignment Management",
  wc_cross_location_assignment_visibility: "Cross-Location Assignment Visibility",
  wc_advanced_notification_rules:          "Advanced Notification Rules",
  wc_executive_daily_briefings:            "Executive Daily Briefings",
  wc_sms_gateway:                          "SMS Gateway",
  wc_custom_notification_providers:        "Custom Notification Providers",
  wc_custom_escalation_policies:           "Custom Escalation Policies",
  wc_compliance_logging:                   "Compliance Logging",
  wc_advanced_audit_history:               "Advanced Audit History",
  wc_api_access_communications:            "API Access — Communications",
  wc_white_label_communications:           "White-label Communications",
  wc_enterprise_communication_controls:    "Enterprise Communication Controls",
}

export const WC_FLAG_DESCRIPTIONS: Record<keyof OrgWCFlags, string> = {
  wc_personal_inbox:                       "Employees see their personal work inbox showing assignments and messages.",
  wc_individual_assignments:               "Basic assignment of tasks to individual employees with due date and priority.",
  wc_basic_notifications:                  "Core system notifications for assignment changes and issue updates.",
  wc_basic_announcements:                  "View and receive announcements from managers.",
  wc_company_announcements:                "Create company-wide announcements visible to all org members.",
  wc_personal_reminders:                   "Employees can set personal reminders for their tasks.",
  wc_push_notifications:                   "Native push notifications to mobile devices via Capacitor.",
  wc_email_notifications:                  "Email delivery for critical notifications and daily digests.",
  wc_inapp_notifications:                  "In-app notification bell with unread badge count.",
  wc_basic_daily_briefing:                 "Basic daily briefing showing today's assignments and open issues as a list.",
  wc_announcement_history_readonly:        "View past announcements in read-only mode.",
  wc_department_announcements:             "Send announcements targeted to a specific department.",
  wc_team_announcements:                   "Send announcements to a supervisor's team (their direct reports).",
  wc_shift_announcements:                  "Send announcements targeted to a specific shift.",
  wc_emergency_broadcasts:                 "Send emergency broadcasts with real-time acknowledgment tracking.",
  wc_assignment_management:                "Full assignment management: create, assign, track, and close work orders.",
  wc_assignment_comments:                  "Comment thread on each assignment for assignee-manager communication.",
  wc_assignment_attachments:               "Attach files and photos to assignments.",
  wc_assignment_history:                   "Full status history timeline for each assignment.",
  wc_announcement_acknowledgements:        "Require and track acknowledgment of announcements per user.",
  wc_ai_daily_briefing:                    "AI-generated daily briefing using Claude, personalized per employee.",
  wc_manager_announcement_dashboard:       "Manager view showing announcement reach, read rates, and acknowledgments.",
  wc_supervisor_tools:                     "Supervisor-specific tools: team workload view, shift handoff notes.",
  wc_communication_search:                 "Full-text search across announcements, broadcasts, and messages.",
  wc_inbox_filters:                        "Filter inbox by type, priority, sender, and date.",
  wc_notification_preferences:             "Per-user notification preference controls (channels, frequency, quiet hours).",
  wc_department_communication_permissions: "Grant department-level managers permission to send announcements.",
  wc_multi_location_announcements:         "Target announcements to specific locations across the organization.",
  wc_regional_announcements:               "Send announcements to all locations within a region.",
  wc_executive_announcements:              "Executive-tier announcements with priority delivery to all managers.",
  wc_org_wide_broadcasts:                  "Organization-wide emergency and operational broadcasts.",
  wc_cross_location_communication:         "Communicate across locations with routing and visibility controls.",
  wc_communication_analytics:              "Analytics dashboard: open rates, acknowledgment rates, response times.",
  wc_announcement_reporting:               "Exportable reports of announcement history and reach.",
  wc_read_rate_analytics:                  "Per-announcement read rate broken down by department and location.",
  wc_executive_communication_dashboard:    "Executive view of all org communications with summary metrics.",
  wc_ai_communication_summaries:           "AI-generated summaries of communication activity for executive review.",
  wc_ai_announcement_drafting:             "AI-assisted announcement drafting based on issue or asset context.",
  wc_org_wide_assignment_management:       "Create and manage assignments across all locations and departments.",
  wc_cross_location_assignment_visibility: "View and report on assignments across all org locations.",
  wc_advanced_notification_rules:          "Custom rule engine for notification routing, deduplication, and escalation.",
  wc_executive_daily_briefings:            "AI-powered executive daily briefings with org-wide operational summary.",
  wc_sms_gateway:                          "SMS delivery for emergency broadcasts and critical notifications.",
  wc_custom_notification_providers:        "Integrate custom notification providers (PagerDuty, OpsGenie, etc.).",
  wc_custom_escalation_policies:           "Custom escalation policies for unacknowledged communications.",
  wc_compliance_logging:                   "Compliance-grade logging of all communications with immutable audit trail.",
  wc_advanced_audit_history:               "Full audit history: who sent what, when, and who acknowledged it.",
  wc_api_access_communications:            "API access to communications data for external system integration.",
  wc_white_label_communications:           "White-label the communications interface with custom branding.",
  wc_enterprise_communication_controls:    "Enterprise governance: approval workflows, content policies, and controls.",
}

export type AnnouncementScopeValue = "org" | "location" | "region" | "department" | "team" | "individual"

export interface AnnouncementScopeOption {
  value: AnnouncementScopeValue
  label: string
}
