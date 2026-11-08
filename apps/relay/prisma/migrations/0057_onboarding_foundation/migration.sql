-- Migration 0057: AI-Assisted Onboarding Foundation
-- Adds OnboardingSession and ConfigurationAuditLog tables

CREATE TABLE "OnboardingSession" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentStage"   INTEGER NOT NULL DEFAULT 1,
    "stageData"      JSONB NOT NULL DEFAULT '{}',
    "skippedStages"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "draftOps"       JSONB NOT NULL DEFAULT '[]',
    "completedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingSession_organizationId_key" ON "OnboardingSession"("organizationId");

CREATE TABLE "ConfigurationAuditLog" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "actorId"         TEXT NOT NULL,
    "source"          TEXT NOT NULL,
    "operationType"   TEXT NOT NULL,
    "idempotencyKey"  TEXT,
    "targetModel"     TEXT,
    "targetId"        TEXT,
    "before"          JSONB,
    "after"           JSONB,
    "batchId"         TEXT,
    "sessionId"       TEXT,
    "appliedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConfigurationAuditLog_organizationId_appliedAt_idx" ON "ConfigurationAuditLog"("organizationId", "appliedAt" DESC);
CREATE INDEX "ConfigurationAuditLog_batchId_idx" ON "ConfigurationAuditLog"("batchId");

-- Foreign key constraints
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfigurationAuditLog" ADD CONSTRAINT "ConfigurationAuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
