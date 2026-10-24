-- AlterTable: extend DashboardLayout with Phase 2 fields
ALTER TABLE "DashboardLayout"
  ADD COLUMN IF NOT EXISTS "isOrgDefault"     BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sharedWith"       TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "templateCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByRole"    TEXT;

-- CreateIndex for org default lookups
CREATE INDEX IF NOT EXISTS "DashboardLayout_organizationId_isOrgDefault_idx"
  ON "DashboardLayout"("organizationId", "isOrgDefault");

-- CreateTable: DashboardReport
CREATE TABLE IF NOT EXISTS "DashboardReport" (
    "id"                TEXT      NOT NULL,
    "organizationId"    TEXT      NOT NULL,
    "dashboardLayoutId" TEXT      NOT NULL,
    "name"              TEXT      NOT NULL,
    "frequency"         TEXT      NOT NULL,
    "dayOfWeek"         INTEGER,
    "dayOfMonth"        INTEGER,
    "sendTime"          TEXT      NOT NULL,
    "recipients"        JSONB     NOT NULL DEFAULT '[]',
    "lastSentAt"        TIMESTAMP(3),
    "isActive"          BOOLEAN   NOT NULL DEFAULT true,
    "createdById"       TEXT      NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DashboardReport_organizationId_idx"
  ON "DashboardReport"("organizationId");

CREATE INDEX IF NOT EXISTS "DashboardReport_isActive_frequency_idx"
  ON "DashboardReport"("isActive", "frequency");

ALTER TABLE "DashboardReport"
  ADD CONSTRAINT "DashboardReport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DashboardReport_dashboardLayoutId_fkey"
    FOREIGN KEY ("dashboardLayoutId") REFERENCES "DashboardLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DashboardReport_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DashboardAlert
CREATE TABLE IF NOT EXISTS "DashboardAlert" (
    "id"              TEXT      NOT NULL,
    "organizationId"  TEXT      NOT NULL,
    "name"            TEXT      NOT NULL,
    "metricKey"       TEXT      NOT NULL,
    "condition"       TEXT      NOT NULL,
    "threshold"       DECIMAL(65,30) NOT NULL,
    "dateRange"       TEXT      NOT NULL DEFAULT '30d',
    "locationId"      TEXT,
    "notifyUserIds"   JSONB     NOT NULL DEFAULT '[]',
    "isActive"        BOOLEAN   NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdById"     TEXT      NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DashboardAlert_organizationId_idx"
  ON "DashboardAlert"("organizationId");

CREATE INDEX IF NOT EXISTS "DashboardAlert_isActive_idx"
  ON "DashboardAlert"("isActive");

ALTER TABLE "DashboardAlert"
  ADD CONSTRAINT "DashboardAlert_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DashboardAlert_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
