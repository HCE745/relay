-- Phase 5: CrmTask table
-- Phase 7: CrmCommissionEvent table

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "opportunityId" TEXT,
  "prospectId"    TEXT,
  "demoCallId"    TEXT,
  "assignedToId"  TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "taskType"      TEXT NOT NULL DEFAULT 'other',
  "dueAt"         TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "notes"         TEXT,
  "priority"      TEXT NOT NULL DEFAULT 'normal',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_demoCallId_fkey"
    FOREIGN KEY ("demoCallId") REFERENCES "DemoCall"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmTask_assignedToId_idx"  ON "CrmTask"("assignedToId");
CREATE INDEX IF NOT EXISTS "CrmTask_dueAt_idx"         ON "CrmTask"("dueAt");
CREATE INDEX IF NOT EXISTS "CrmTask_opportunityId_idx" ON "CrmTask"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmTask_completedAt_idx"   ON "CrmTask"("completedAt");

-- Commission ledger
CREATE TABLE IF NOT EXISTS "CrmCommissionEvent" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "opportunityId" TEXT NOT NULL,
  "salesUserId"   TEXT NOT NULL,
  "role"          TEXT NOT NULL DEFAULT 'closer',
  "splitPercent"  INTEGER NOT NULL DEFAULT 100,
  "amount"        DECIMAL(12,2),
  "paidAt"        TIMESTAMP(3),
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCommissionEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CrmCommissionEvent" ADD CONSTRAINT "CrmCommissionEvent_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmCommissionEvent" ADD CONSTRAINT "CrmCommissionEvent_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmCommissionEvent_opportunityId_idx" ON "CrmCommissionEvent"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmCommissionEvent_salesUserId_idx"   ON "CrmCommissionEvent"("salesUserId");
