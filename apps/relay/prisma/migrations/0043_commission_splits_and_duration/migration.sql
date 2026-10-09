-- CommissionAttribution: add split support + date windows
ALTER TABLE "CommissionAttribution"
  ADD COLUMN "splitPercent"       INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN "commissionStartDate" TIMESTAMP(3),
  ADD COLUMN "commissionEndDate"   TIMESTAMP(3);

-- Remove unique constraint on opportunityId so multiple attributions can exist per opportunity (splits)
DROP INDEX IF EXISTS "CommissionAttribution_opportunityId_key";

-- SalesUser: add commission duration setting
ALTER TABLE "SalesUser"
  ADD COLUMN "commissionDuration" TEXT NOT NULL DEFAULT 'LIFETIME';
