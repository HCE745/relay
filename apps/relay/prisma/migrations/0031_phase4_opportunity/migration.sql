-- Phase 4: CrmOpportunity table

CREATE TABLE IF NOT EXISTS "CrmOpportunity" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "prospectId"     TEXT,
  "demoCallId"     TEXT,
  "organizationId" TEXT,
  "assignedToId"   TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "product"        TEXT NOT NULL DEFAULT '',
  "stage"          TEXT NOT NULL DEFAULT 'Qualified',
  "value"          DECIMAL(12,2),
  "closeDate"      TIMESTAMP(3),
  "lostReason"     TEXT,
  "notes"          TEXT,
  "wonAt"          TIMESTAMP(3),
  "lostAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_demoCallId_fkey"
    FOREIGN KEY ("demoCallId") REFERENCES "DemoCall"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmOpportunity_assignedToId_idx" ON "CrmOpportunity"("assignedToId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_stage_idx"        ON "CrmOpportunity"("stage");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_prospectId_idx"   ON "CrmOpportunity"("prospectId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_demoCallId_idx"   ON "CrmOpportunity"("demoCallId");
