-- Add notification rules and priority rules JSON config columns to Organization
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "notificationRulesConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "priorityRulesConfig" JSONB;

-- Add acknowledgment fields to Issue
ALTER TABLE "Issue"
  ADD COLUMN IF NOT EXISTS "acknowledgedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "acknowledgedById" TEXT;
