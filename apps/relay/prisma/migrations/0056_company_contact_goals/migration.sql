-- Migration 0056: Company/Contact model enhancements and Sales Goals
--
-- Extends Prospect (Company) with phone, description, tags
-- Adds contactId FK to CrmEmail, SalesCrmActivity, CrmTask, CrmOpportunity
-- Adds prospectId FK to CrmEmail (direct company link on emails)
-- Adds SalesGoal model for rep and team targets

-- ── Prospect (Company) additions ──────────────────────────────────────────────
ALTER TABLE "Prospect" ADD COLUMN IF NOT EXISTS "phone"       TEXT;
ALTER TABLE "Prospect" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Prospect" ADD COLUMN IF NOT EXISTS "tags"        TEXT[] DEFAULT '{}';

-- ── ProspectContact index on email ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "ProspectContact_email_idx" ON "ProspectContact"("email");

-- ── CrmEmail: direct company and contact links ────────────────────────────────
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "prospectId" TEXT REFERENCES "Prospect"(id) ON DELETE SET NULL;
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "contactId"  TEXT REFERENCES "ProspectContact"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CrmEmail_prospectId_idx" ON "CrmEmail"("prospectId");
CREATE INDEX IF NOT EXISTS "CrmEmail_contactId_idx"  ON "CrmEmail"("contactId");

-- ── SalesCrmActivity: contact link ───────────────────────────────────────────
ALTER TABLE "SalesCrmActivity" ADD COLUMN IF NOT EXISTS "contactId" TEXT REFERENCES "ProspectContact"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "SalesCrmActivity_contactId_idx" ON "SalesCrmActivity"("contactId");

-- ── CrmTask: contact link ─────────────────────────────────────────────────────
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "contactId" TEXT REFERENCES "ProspectContact"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CrmTask_contactId_idx" ON "CrmTask"("contactId");

-- ── CrmOpportunity: contact link ─────────────────────────────────────────────
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "contactId" TEXT REFERENCES "ProspectContact"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CrmOpportunity_contactId_idx" ON "CrmOpportunity"("contactId");

-- ── SalesGoal ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SalesGoal" (
  "id"                   TEXT         NOT NULL,
  "salesUserId"          TEXT,
  "prospectId"           TEXT,
  "metric"               TEXT         NOT NULL,
  "period"               TEXT         NOT NULL,
  "targetValue"          DECIMAL(12,2) NOT NULL,
  "startDate"            DATE         NOT NULL,
  "endDate"              DATE         NOT NULL,
  "notes"                TEXT,
  "createdBySalesUserId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesGoal_salesUserId_fkey"          FOREIGN KEY ("salesUserId")          REFERENCES "SalesUser"(id)        ON DELETE SET NULL,
  CONSTRAINT "SalesGoal_createdBySalesUserId_fkey"  FOREIGN KEY ("createdBySalesUserId")  REFERENCES "SalesUser"(id)        ON DELETE SET NULL,
  CONSTRAINT "SalesGoal_prospectId_fkey"            FOREIGN KEY ("prospectId")            REFERENCES "Prospect"(id)         ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "SalesGoal_salesUserId_idx" ON "SalesGoal"("salesUserId");
CREATE INDEX IF NOT EXISTS "SalesGoal_period_idx"      ON "SalesGoal"("period");
CREATE INDEX IF NOT EXISTS "SalesGoal_dates_idx"       ON "SalesGoal"("startDate", "endDate");
