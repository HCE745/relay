-- NOTE (2026-10-20): Supabase is changing Data API permissions on 2026-10-30.
-- Tables created after that date need explicit GRANTs if PostgREST / supabase-js is used.
-- Relay does NOT use the Supabase Data API — only a direct DATABASE_URL via Prisma —
-- so these GRANTs are not required. See prisma/migrations/MIGRATION_TEMPLATE.sql
-- for the pattern to add if this ever changes.

-- CreateTable SalesSession
CREATE TABLE "SalesSession" (
    "id"              TEXT NOT NULL,
    "salesUserId"     TEXT NOT NULL,
    "loginAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt"        TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "pagesVisited"    JSONB NOT NULL DEFAULT '[]',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesSession_salesUserId_idx" ON "SalesSession"("salesUserId");
CREATE INDEX "SalesSession_loginAt_idx" ON "SalesSession"("loginAt");
CREATE INDEX "SalesSession_logoutAt_idx" ON "SalesSession"("logoutAt");
ALTER TABLE "SalesSession" ADD CONSTRAINT "SalesSession_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable SalesDailyActivity
CREATE TABLE "SalesDailyActivity" (
    "id"                   TEXT NOT NULL,
    "salesUserId"          TEXT NOT NULL,
    "date"                 DATE NOT NULL,
    "emailsSent"           INTEGER NOT NULL DEFAULT 0,
    "followUpsWorked"      INTEGER NOT NULL DEFAULT 0,
    "prospectsContacted"   INTEGER NOT NULL DEFAULT 0,
    "prospectsAdded"       INTEGER NOT NULL DEFAULT 0,
    "opportunitiesUpdated" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted"       INTEGER NOT NULL DEFAULT 0,
    "demosLogged"          INTEGER NOT NULL DEFAULT 0,
    "timeInAppMinutes"     INTEGER NOT NULL DEFAULT 0,
    "firstActivityAt"      TIMESTAMP(3),
    "lastActivityAt"       TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesDailyActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesDailyActivity_salesUserId_date_key" ON "SalesDailyActivity"("salesUserId", "date");
CREATE INDEX "SalesDailyActivity_salesUserId_idx" ON "SalesDailyActivity"("salesUserId");
CREATE INDEX "SalesDailyActivity_date_idx" ON "SalesDailyActivity"("date");
ALTER TABLE "SalesDailyActivity" ADD CONSTRAINT "SalesDailyActivity_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
