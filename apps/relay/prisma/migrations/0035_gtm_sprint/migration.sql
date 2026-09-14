-- Add prospectId FK to DemoCall
ALTER TABLE "DemoCall" ADD COLUMN IF NOT EXISTS "prospectId" TEXT;
ALTER TABLE "DemoCall" ADD CONSTRAINT "DemoCall_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DemoCall_prospectId_idx" ON "DemoCall"("prospectId");

-- Backfill: link existing DemoCalls to Prospects by matching companyName (case-insensitive)
UPDATE "DemoCall" d
SET "prospectId" = p.id
FROM "Prospect" p
WHERE d."prospectId" IS NULL
  AND lower(d."companyName") = lower(p."companyName");

-- Add organizationId and source to UnsubscribeRecord
ALTER TABLE "UnsubscribeRecord" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "UnsubscribeRecord" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- Add roles array to ProspectContact
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT '{}';
