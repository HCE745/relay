-- P0/P1 GTM Audit Fixes
-- 1. Add phone + role to ProspectContact
-- 2. Add nextStep + nextStepDate to CrmOpportunity
-- 3. Add bouncedAt + bounceType to CrmEmail
-- 4. Create UnsubscribeRecord table

ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "role"  TEXT;

ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "nextStep"     TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "nextStepDate" TIMESTAMP(3);

ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "bouncedAt"  TIMESTAMP(3);
ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "bounceType" TEXT;

CREATE TABLE IF NOT EXISTS "UnsubscribeRecord" (
    "id"       TEXT NOT NULL,
    "email"    TEXT NOT NULL,
    "reason"   TEXT NOT NULL DEFAULT 'UNSUBSCRIBE',
    "addedById" TEXT,
    "addedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"    TEXT,
    CONSTRAINT "UnsubscribeRecord_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "UnsubscribeRecord_email_key" ON "UnsubscribeRecord"("email");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
