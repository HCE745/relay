-- Phase 2: Account Ownership
-- Add assignedToId + productInterest to DemoCall and Prospect

ALTER TABLE "DemoCall"
  ADD COLUMN IF NOT EXISTS "assignedToId"    TEXT,
  ADD COLUMN IF NOT EXISTS "productInterest" TEXT;

ALTER TABLE "Prospect"
  ADD COLUMN IF NOT EXISTS "assignedToId"    TEXT,
  ADD COLUMN IF NOT EXISTS "productInterest" TEXT;

-- FK constraints (idempotent)
DO $$ BEGIN
  ALTER TABLE "DemoCall" ADD CONSTRAINT "DemoCall_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "DemoCall_assignedToId_idx" ON "DemoCall"("assignedToId");
CREATE INDEX IF NOT EXISTS "Prospect_assignedToId_idx" ON "Prospect"("assignedToId");

-- Backfill: assign all existing unassigned records to the first SalesUser if one exists
DO $$
DECLARE
  first_sales_user_id TEXT;
BEGIN
  SELECT id INTO first_sales_user_id FROM "SalesUser" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1;
  IF first_sales_user_id IS NOT NULL THEN
    UPDATE "DemoCall"  SET "assignedToId" = first_sales_user_id WHERE "assignedToId" IS NULL;
    UPDATE "Prospect"  SET "assignedToId" = first_sales_user_id WHERE "assignedToId" IS NULL;
  END IF;
END $$;
