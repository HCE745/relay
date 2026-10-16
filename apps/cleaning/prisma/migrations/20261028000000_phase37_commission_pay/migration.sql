-- Phase 37: commission & crew-based pay rules. Additive.
CREATE TYPE "cleaning"."PayBasis" AS ENUM ('HOURLY', 'FLAT_PER_JOB', 'PERCENT_OF_JOB_REVENUE');
CREATE TYPE "cleaning"."PaySplitMode" AS ENUM ('PER_PERSON', 'SPLIT_ACROSS_CREW');
CREATE TYPE "cleaning"."JobEarningStatus" AS ENUM ('CALCULATED', 'PENDING', 'VOIDED');

CREATE TABLE "cleaning"."PayRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT,
    "basis" "cleaning"."PayBasis" NOT NULL,
    "splitMode" "cleaning"."PaySplitMode" NOT NULL DEFAULT 'PER_PERSON',
    "soloValue" DECIMAL(12,3),
    "pairValue" DECIMAL(12,3),
    "crewValue" DECIMAL(12,3),
    "customerId" TEXT,
    "serviceLocationId" TEXT,
    "servicePlanId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayRule_organizationId_isActive_idx" ON "cleaning"."PayRule"("organizationId", "isActive");
ALTER TABLE "cleaning"."PayRule" ADD CONSTRAINT "PayRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."PayRule" ADD CONSTRAINT "PayRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."JobEarning" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basis" "cleaning"."PayBasis" NOT NULL,
    "splitMode" "cleaning"."PaySplitMode" NOT NULL,
    "crewSize" INTEGER NOT NULL,
    "percentApplied" DECIMAL(6,3),
    "flatApplied" DECIMAL(12,2),
    "billableAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "cleaning"."JobEarningStatus" NOT NULL DEFAULT 'CALCULATED',
    "ruleId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobEarning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobEarning_jobId_userId_key" ON "cleaning"."JobEarning"("jobId", "userId");
CREATE INDEX "JobEarning_organizationId_idx" ON "cleaning"."JobEarning"("organizationId");
ALTER TABLE "cleaning"."JobEarning" ADD CONSTRAINT "JobEarning_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."JobEarning" ADD CONSTRAINT "JobEarning_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."JobEarning" ADD CONSTRAINT "JobEarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
