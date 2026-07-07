-- Enable Row-Level Security on all tables.
--
-- Why: Supabase exposes a PostgREST Data API (anon / authenticated roles).
-- Enabling RLS with no permissive policies for those roles means the API
-- returns nothing and accepts no writes — default-deny for non-owner roles.
--
-- Prisma connects as the postgres superuser which has BYPASSRLS, so all
-- application queries continue to work exactly as before.

ALTER TABLE "Organization"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Issue"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssueComment"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssueHistory"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssueEscalation"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EscalationPolicy"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EscalationStep"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceLog"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoutingRule"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Suggestion"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailTemplate"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuperAdmin"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImpersonationLog"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuperAdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserLocation"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeType"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsSnapshot"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformConfig"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssuePattern"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SOP"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseRequest"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InjuryReport"       ENABLE ROW LEVEL SECURITY;
