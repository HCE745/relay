-- Feature 1: ProspectContact enrichment fields
ALTER TABLE "ProspectContact"
  ADD COLUMN IF NOT EXISTS "verifiedPhone"        TEXT,
  ADD COLUMN IF NOT EXISTS "directEmail"          TEXT,
  ADD COLUMN IF NOT EXISTS "emailConfidenceScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "jobLevel"             TEXT,
  ADD COLUMN IF NOT EXISTS "department"           TEXT,
  ADD COLUMN IF NOT EXISTS "isPrimaryContact"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isDecisionMaker"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isChampion"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastVerifiedAt"       TIMESTAMP(3);

-- Feature 6: CrmOpportunity qualification fields
ALTER TABLE "CrmOpportunity"
  ADD COLUMN IF NOT EXISTS "qualificationScore"  INTEGER,
  ADD COLUMN IF NOT EXISTS "qualificationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "qualifiedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disqualifiedReason"  TEXT;

-- Feature 2: SalesCrmActivity timeline
CREATE TABLE IF NOT EXISTS "SalesCrmActivity" (
  "id"              TEXT NOT NULL,
  "prospectId"      TEXT,
  "demoCallId"      TEXT,
  "opportunityId"   TEXT,
  "salesUserId"     TEXT,
  "activityType"    TEXT NOT NULL,
  "subject"         TEXT,
  "notes"           TEXT,
  "outcome"         TEXT,
  "durationMinutes" INTEGER,
  "metadata"        JSONB,
  "occurredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesCrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesCrmActivity_prospectId_idx"    ON "SalesCrmActivity"("prospectId");
CREATE INDEX IF NOT EXISTS "SalesCrmActivity_demoCallId_idx"    ON "SalesCrmActivity"("demoCallId");
CREATE INDEX IF NOT EXISTS "SalesCrmActivity_opportunityId_idx" ON "SalesCrmActivity"("opportunityId");
CREATE INDEX IF NOT EXISTS "SalesCrmActivity_salesUserId_idx"   ON "SalesCrmActivity"("salesUserId");
CREATE INDEX IF NOT EXISTS "SalesCrmActivity_occurredAt_idx"    ON "SalesCrmActivity"("occurredAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SalesCrmActivity_prospectId_fkey'
  ) THEN
    ALTER TABLE "SalesCrmActivity"
      ADD CONSTRAINT "SalesCrmActivity_prospectId_fkey"
      FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SalesCrmActivity_demoCallId_fkey'
  ) THEN
    ALTER TABLE "SalesCrmActivity"
      ADD CONSTRAINT "SalesCrmActivity_demoCallId_fkey"
      FOREIGN KEY ("demoCallId") REFERENCES "DemoCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SalesCrmActivity_opportunityId_fkey'
  ) THEN
    ALTER TABLE "SalesCrmActivity"
      ADD CONSTRAINT "SalesCrmActivity_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SalesCrmActivity_salesUserId_fkey'
  ) THEN
    ALTER TABLE "SalesCrmActivity"
      ADD CONSTRAINT "SalesCrmActivity_salesUserId_fkey"
      FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Feature 5: CrmObjection
CREATE TABLE IF NOT EXISTS "CrmObjection" (
  "id"            TEXT NOT NULL,
  "prospectId"    TEXT,
  "demoCallId"    TEXT,
  "opportunityId" TEXT,
  "salesUserId"   TEXT NOT NULL,
  "objectionType" TEXT NOT NULL,
  "objectionText" TEXT NOT NULL,
  "responseGiven" TEXT,
  "wasResolved"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmObjection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmObjection_prospectId_idx"    ON "CrmObjection"("prospectId");
CREATE INDEX IF NOT EXISTS "CrmObjection_demoCallId_idx"    ON "CrmObjection"("demoCallId");
CREATE INDEX IF NOT EXISTS "CrmObjection_opportunityId_idx" ON "CrmObjection"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmObjection_salesUserId_idx"   ON "CrmObjection"("salesUserId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmObjection_prospectId_fkey'
  ) THEN
    ALTER TABLE "CrmObjection"
      ADD CONSTRAINT "CrmObjection_prospectId_fkey"
      FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmObjection_demoCallId_fkey'
  ) THEN
    ALTER TABLE "CrmObjection"
      ADD CONSTRAINT "CrmObjection_demoCallId_fkey"
      FOREIGN KEY ("demoCallId") REFERENCES "DemoCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmObjection_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmObjection"
      ADD CONSTRAINT "CrmObjection_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmObjection_salesUserId_fkey'
  ) THEN
    ALTER TABLE "CrmObjection"
      ADD CONSTRAINT "CrmObjection_salesUserId_fkey"
      FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
