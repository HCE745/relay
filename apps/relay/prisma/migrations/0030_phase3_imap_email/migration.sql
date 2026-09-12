-- Phase 3: Scoped Email per Rep
-- Make ImapConfig.superAdminId nullable, add salesUserId
-- Add sentBySalesUserId to CrmEmail

-- Make superAdminId nullable (existing rows keep their value)
ALTER TABLE "ImapConfig" ALTER COLUMN "superAdminId" DROP NOT NULL;

-- Add salesUserId column
ALTER TABLE "ImapConfig"
  ADD COLUMN IF NOT EXISTS "salesUserId" TEXT UNIQUE;

-- FK for salesUserId
DO $$ BEGIN
  ALTER TABLE "ImapConfig" ADD CONSTRAINT "ImapConfig_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add sentBySalesUserId to CrmEmail
ALTER TABLE "CrmEmail"
  ADD COLUMN IF NOT EXISTS "sentBySalesUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_sentBySalesUserId_fkey"
    FOREIGN KEY ("sentBySalesUserId") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmEmail_sentBySalesUserId_idx" ON "CrmEmail"("sentBySalesUserId");
