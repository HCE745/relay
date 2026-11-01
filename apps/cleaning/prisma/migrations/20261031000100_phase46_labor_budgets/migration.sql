-- Phase 46: labor budgeting & variance. A run-rate (weekly/monthly) budget of
-- expected labor hours and cost on a contract, site or service plan; the report
-- compares it to scheduled and actual labor and flags unprofitable contracts.
-- Planning only — never payroll processing.

CREATE TYPE "cleaning"."BudgetScope" AS ENUM ('CONTRACT', 'SITE', 'PLAN');
CREATE TYPE "cleaning"."BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

CREATE TABLE "cleaning"."LaborBudget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" "cleaning"."BudgetScope" NOT NULL,
    "contractId" TEXT,
    "serviceLocationId" TEXT,
    "servicePlanId" TEXT,
    "period" "cleaning"."BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "budgetedHours" DECIMAL(10,2) NOT NULL,
    "budgetedCost" DECIMAL(12,2) NOT NULL,
    "alertUnprofitable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaborBudget_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LaborBudget_organizationId_idx" ON "cleaning"."LaborBudget"("organizationId");
ALTER TABLE "cleaning"."LaborBudget" ADD CONSTRAINT "LaborBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."LaborBudget" ADD CONSTRAINT "LaborBudget_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "cleaning"."Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."LaborBudget" ADD CONSTRAINT "LaborBudget_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."LaborBudget" ADD CONSTRAINT "LaborBudget_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "cleaning"."ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
