-- Phase 43: shift differentials & labor burden. Differential rules pay a premium
-- on approved hours in a time window / on given days (snapshotted onto the time
-- entry at approval). Labor burden loads employer taxes/insurance/comp onto
-- labor cost for profitability only. Costing/export figures — never payroll.

CREATE TYPE "cleaning"."DifferentialAmountType" AS ENUM ('PERCENT', 'FLAT_PER_HOUR');

CREATE TABLE "cleaning"."ShiftDifferentialRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "amountType" "cleaning"."DifferentialAmountType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(10,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftDifferentialRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShiftDifferentialRule_organizationId_idx" ON "cleaning"."ShiftDifferentialRule"("organizationId");
ALTER TABLE "cleaning"."ShiftDifferentialRule" ADD CONSTRAINT "ShiftDifferentialRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Differential premium snapshot on the approved time entry.
ALTER TABLE "cleaning"."TimeEntry" ADD COLUMN "approvedDifferential" DECIMAL(10,2);
ALTER TABLE "cleaning"."TimeEntry" ADD COLUMN "approvedDifferentialNote" TEXT;

-- Labor burden fraction (0.25 = 25%), costing only.
ALTER TABLE "cleaning"."Organization" ADD COLUMN "laborBurdenPct" DECIMAL(5,4) NOT NULL DEFAULT 0;
