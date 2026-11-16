-- Persistent research job: tracks multi-round AI discovery progress
-- Each job owns one ProspectResearchList (created at job start, results saved incrementally)

CREATE TABLE "ProspectResearchJob" (
  "id"                TEXT          NOT NULL,
  "salesUserId"       TEXT,
  "superAdminId"      TEXT,
  "listId"            TEXT          UNIQUE,          -- linked research list
  "country"           TEXT          NOT NULL,
  "stateProvince"     TEXT,
  "industry"          TEXT          NOT NULL,
  "employeeCountMin"  INTEGER       NOT NULL,
  "employeeCountMax"  INTEGER       NOT NULL,
  "keywords"          TEXT,
  "additionalContext" TEXT,
  "requestedCount"    INTEGER       NOT NULL,
  "status"            TEXT          NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|cancelled
  "roundsCompleted"   INTEGER       NOT NULL DEFAULT 0,
  "roundsMax"         INTEGER       NOT NULL DEFAULT 5,
  "acceptedCount"     INTEGER       NOT NULL DEFAULT 0,
  "agentState"        JSONB,                                     -- agent memory: seen companies, strategies tried
  "lockedAt"          TIMESTAMP(3),                              -- when last lock was acquired
  "lockedUntil"       TIMESTAMP(3),                              -- lock expires at this time
  "inputTokensTotal"  INTEGER       NOT NULL DEFAULT 0,
  "outputTokensTotal" INTEGER       NOT NULL DEFAULT 0,
  "searchCallsTotal"  INTEGER       NOT NULL DEFAULT 0,
  "budgetUsd"         REAL          NOT NULL DEFAULT 2.0,  -- per-job dollar spending cap
  "failedRounds"      INTEGER       NOT NULL DEFAULT 0,    -- consecutive round failures; resets on success
  "lastError"         TEXT,
  "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectResearchJob_status_idx"       ON "ProspectResearchJob"("status");
CREATE INDEX "ProspectResearchJob_salesUserId_idx"  ON "ProspectResearchJob"("salesUserId");
CREATE INDEX "ProspectResearchJob_superAdminId_idx" ON "ProspectResearchJob"("superAdminId");
CREATE INDEX "ProspectResearchJob_createdAt_idx"    ON "ProspectResearchJob"("createdAt");
CREATE INDEX "ProspectResearchJob_lockedUntil_idx"  ON "ProspectResearchJob"("lockedUntil");

ALTER TABLE "ProspectResearchJob"
  ADD CONSTRAINT "ProspectResearchJob_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProspectResearchJob"
  ADD CONSTRAINT "ProspectResearchJob_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
