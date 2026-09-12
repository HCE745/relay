-- Phase 8: Transfer system

CREATE TABLE IF NOT EXISTS "CrmTransferLog" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "recordType"          TEXT NOT NULL,
  "recordId"            TEXT NOT NULL,
  "opportunityId"       TEXT,
  "fromSalesUserId"     TEXT,
  "toSalesUserId"       TEXT NOT NULL,
  "transferredBySAId"   TEXT,
  "transferredByUserId" TEXT,
  "reason"              TEXT,
  "recordsTransferred"  JSONB NOT NULL DEFAULT '[]',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmTransferLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CrmTransferLog" ADD CONSTRAINT "CrmTransferLog_fromSalesUserId_fkey"
    FOREIGN KEY ("fromSalesUserId") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferLog" ADD CONSTRAINT "CrmTransferLog_toSalesUserId_fkey"
    FOREIGN KEY ("toSalesUserId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferLog" ADD CONSTRAINT "CrmTransferLog_transferredByUserId_fkey"
    FOREIGN KEY ("transferredByUserId") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferLog" ADD CONSTRAINT "CrmTransferLog_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmTransferLog_recordType_recordId_idx" ON "CrmTransferLog"("recordType", "recordId");
CREATE INDEX IF NOT EXISTS "CrmTransferLog_toSalesUserId_idx"       ON "CrmTransferLog"("toSalesUserId");

CREATE TABLE IF NOT EXISTS "CrmTransferRequest" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "recordType"        TEXT NOT NULL,
  "recordId"          TEXT NOT NULL,
  "opportunityId"     TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "toSalesUserId"     TEXT NOT NULL,
  "reason"            TEXT,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "reviewedById"      TEXT,
  "reviewedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmTransferRequest_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CrmTransferRequest" ADD CONSTRAINT "CrmTransferRequest_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferRequest" ADD CONSTRAINT "CrmTransferRequest_toSalesUserId_fkey"
    FOREIGN KEY ("toSalesUserId") REFERENCES "SalesUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferRequest" ADD CONSTRAINT "CrmTransferRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "SalesUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTransferRequest" ADD CONSTRAINT "CrmTransferRequest_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CrmTransferRequest_status_idx"                ON "CrmTransferRequest"("status");
CREATE INDEX IF NOT EXISTS "CrmTransferRequest_recordType_recordId_idx"   ON "CrmTransferRequest"("recordType", "recordId");
