-- Phase 45: indirect cost allocation. Named cost pools (equipment, insurance,
-- overhead) spread across sites/customers/plans on the profitability report by a
-- chosen driver. Management reporting only — never a general ledger.

CREATE TYPE "cleaning"."IndirectCostCategory" AS ENUM ('EQUIPMENT', 'INSURANCE', 'OVERHEAD', 'OTHER');
CREATE TYPE "cleaning"."CostAllocationBasis" AS ENUM ('REVENUE', 'LABOR_COST', 'LABOR_HOURS', 'JOB_COUNT', 'EVEN');

CREATE TABLE "cleaning"."IndirectCostPool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "cleaning"."IndirectCostCategory" NOT NULL DEFAULT 'OVERHEAD',
    "amount" DECIMAL(12,2) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "basis" "cleaning"."CostAllocationBasis" NOT NULL DEFAULT 'REVENUE',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IndirectCostPool_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IndirectCostPool_organizationId_idx" ON "cleaning"."IndirectCostPool"("organizationId");
ALTER TABLE "cleaning"."IndirectCostPool" ADD CONSTRAINT "IndirectCostPool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
