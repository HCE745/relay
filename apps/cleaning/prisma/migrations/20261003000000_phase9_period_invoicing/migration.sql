-- CreateEnum
CREATE TYPE "cleaning"."BillingMode" AS ENUM ('PER_JOB', 'FLAT_PERIOD');

-- CreateEnum
CREATE TYPE "cleaning"."PeriodFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN     "billingMode" "cleaning"."BillingMode" NOT NULL DEFAULT 'PER_JOB',
ADD COLUMN     "periodAmount" DECIMAL(12,2),
ADD COLUMN     "periodFrequency" "cleaning"."PeriodFrequency";

-- AlterTable
ALTER TABLE "cleaning"."InvoiceLine" ADD COLUMN     "activePeriodKey" TEXT,
ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_activePeriodKey_key" ON "cleaning"."InvoiceLine"("activePeriodKey");
