-- Backfill all schema fields that were applied to the database via `prisma db push`
-- but were never captured in a migration file.  Every statement uses
-- IF NOT EXISTS / ALTER COLUMN so the migration is safe to run on any
-- database that is partially or fully up to date.

-- ─── CrmEmail ─────────────────────────────────────────────────────────────────
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "isArchived"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "isDeleted"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "deletedAt"     TIMESTAMP(3);
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "stageNumber"   INTEGER;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "openedAt"      TIMESTAMP(3);
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "openCount"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "lastOpenedAt"  TIMESTAMP(3);

-- ─── Issue ────────────────────────────────────────────────────────────────────
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "resolvedMethod"       TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "resolutionCost"       DOUBLE PRECISION;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "rootCause"            TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "timeToResolve"        TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "resolutionCategory"   TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "submitterSuggestion"  TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "assigneeSuggestion"   TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopId"                TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopViolation"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopMatchConfidence"   DOUBLE PRECISION;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopViolationNote"     TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopLinkSource"        TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sopComplianceOutcome" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "injurySeverity"       TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "injuryDescription"    TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "areaDetail"           TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "isSharedFacilityIssue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sourceOrgId"          TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "sourceOrgName"        TEXT;

-- FK from Issue.sopId → SOP (safe: SOP table exists in the database)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Issue_sopId_fkey'
  ) THEN
    ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sopId_fkey"
      FOREIGN KEY ("sopId") REFERENCES "SOP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Issue_sopId_idx" ON "Issue"("sopId");

-- ─── UserSettings ─────────────────────────────────────────────────────────────
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB NOT NULL DEFAULT '{}';

-- ─── Organization: scalar fields added without migrations ──────────────────────
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companySize"                TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "numberOfLocations"          TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt"      TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "trialStartDate"             TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "trialEndsAt"                TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeCustomerId"           TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"       TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeCouponId"             TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "subscriptionStatus"         TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan"                       TEXT NOT NULL DEFAULT 'essentials';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "productLine"                TEXT NOT NULL DEFAULT 'RELAY_STANDARD';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "employeeLimit"              INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "locationLimit"              INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "checkoutIntentStatus"       TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "intelligenceSuiteEnabled"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "monthlyBasePrice"           DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "monthlyScalingCost"         DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "monthlyModulesCost"         DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "monthlyTotalBeforeDiscount" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "monthlyTotalAfterDiscount"  DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "discountPercent"            INTEGER;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "discountExpiresAt"          TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "discountLabel"              TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "suspendedAt"                TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "isDemo"                     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "demoExpiresAt"              TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiSuggestionsAvailable"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiSuggestionsPolicy"        TEXT NOT NULL DEFAULT 'user_choice';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiSuggestionsAudience"      TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "purchaseRequestEnabled"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "purchaseRequestItemLimit"   DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "purchaseRequestMonthlyLimit" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "injuryAlertEmails"          JSONB;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "sopMatchSensitivity"        TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingFrequency"           TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "currentPrice"               DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "priceLockedUntil"           TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "intelligenceModules"        TEXT[] DEFAULT '{}';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "navigationConfig"           JSONB;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "terminologyConfig"          JSONB;
-- Professional Plus feature flags
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "regions_enabled"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "corporate_dashboard_enabled"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "cross_location_analytics_enabled"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "advanced_escalations_enabled"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "api_webhooks_enabled"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "sso_foundation_enabled"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "shared_facility_enabled"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "qr_codes_enabled"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "external_collaborators_enabled"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "multi_org_enabled"                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "executive_briefings_enabled"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "health_scores_enabled"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "trend_detection_enabled"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "executive_goals_enabled"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "recognition_enabled"               BOOLEAN NOT NULL DEFAULT false;
-- Workforce Communications feature flags
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_personal_inbox"                       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_individual_assignments"               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_basic_notifications"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_basic_announcements"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_company_announcements"                BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_personal_reminders"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_push_notifications"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_email_notifications"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_inapp_notifications"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_basic_daily_briefing"                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_announcement_history_readonly"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_department_announcements"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_team_announcements"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_shift_announcements"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_emergency_broadcasts"                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_assignment_management"                BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_assignment_comments"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_assignment_attachments"               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_assignment_history"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_announcement_acknowledgements"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_ai_daily_briefing"                    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_manager_announcement_dashboard"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_supervisor_tools"                     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_communication_search"                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_inbox_filters"                        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_notification_preferences"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_department_communication_permissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_multi_location_announcements"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_regional_announcements"               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_executive_announcements"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_org_wide_broadcasts"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_cross_location_communication"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_communication_analytics"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_announcement_reporting"               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_read_rate_analytics"                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_executive_communication_dashboard"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_ai_communication_summaries"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_ai_announcement_drafting"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_org_wide_assignment_management"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_cross_location_assignment_visibility" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_advanced_notification_rules"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_executive_daily_briefings"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_sms_gateway"                          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_custom_notification_providers"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_custom_escalation_policies"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_compliance_logging"                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_advanced_audit_history"               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_api_access_communications"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_white_label_communications"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "wc_enterprise_communication_controls"    BOOLEAN NOT NULL DEFAULT false;
