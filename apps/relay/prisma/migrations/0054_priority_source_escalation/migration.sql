-- Priority source tracking on Issue
ALTER TABLE "Issue"
  ADD COLUMN IF NOT EXISTS "prioritySource"   TEXT,
  ADD COLUMN IF NOT EXISTS "priorityRuleName" TEXT,
  ADD COLUMN IF NOT EXISTS "escalationSentAt" TIMESTAMPTZ;

-- Acknowledgment escalation config on Organization
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "ackEscalationConfig" JSONB;

-- Index: quickly find issues that need escalation (CRITICAL/HIGH, unacknowledged, unsent)
CREATE INDEX IF NOT EXISTS "Issue_escalation_check"
  ON "Issue" ("priority", "acknowledgedAt", "escalationSentAt", "status", "createdAt")
  WHERE "acknowledgedAt" IS NULL AND "escalationSentAt" IS NULL;
