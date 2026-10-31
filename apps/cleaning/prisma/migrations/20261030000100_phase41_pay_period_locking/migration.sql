-- Phase 41: payroll period locking. A locked period freezes time entries,
-- corrections, approvals and commission earnings whose work date falls inside
-- it. Only OWNER/ADMIN may unlock (with a reason); every lock/unlock is audited.

CREATE TYPE "cleaning"."PayPeriodStatus" AS ENUM ('OPEN', 'LOCKED');

CREATE TABLE "cleaning"."PayPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "cleaning"."PayPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayPeriod_organizationId_start_end_key" ON "cleaning"."PayPeriod"("organizationId", "start", "end");
CREATE INDEX "PayPeriod_organizationId_status_idx" ON "cleaning"."PayPeriod"("organizationId", "status");
ALTER TABLE "cleaning"."PayPeriod" ADD CONSTRAINT "PayPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."PayPeriod" ADD CONSTRAINT "PayPeriod_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cleaning"."ExportRun" ADD COLUMN "payPeriodId" TEXT;
ALTER TABLE "cleaning"."ExportRun" ADD CONSTRAINT "ExportRun_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "cleaning"."PayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
