-- CreateEnum
CREATE TYPE "cleaning"."ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "cleaning"."ContractBillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME');

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "contractExpiryLeadDays" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN     "contractId" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "contractValue" DECIMAL(12,2),
    "billingFrequency" "cleaning"."ContractBillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "status" "cleaning"."ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_organizationId_idx" ON "cleaning"."Contract"("organizationId");

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "cleaning"."Contract"("customerId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "cleaning"."Contract"("status");

-- CreateIndex
CREATE INDEX "ServicePlan_contractId_idx" ON "cleaning"."ServicePlan"("contractId");

-- AddForeignKey
ALTER TABLE "cleaning"."ServicePlan" ADD CONSTRAINT "ServicePlan_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "cleaning"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

