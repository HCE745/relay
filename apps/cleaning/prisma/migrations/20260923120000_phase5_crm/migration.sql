-- CreateEnum
CREATE TYPE "cleaning"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ESTIMATING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "cleaning"."EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "cleaning"."EstimatePricing" AS ENUM ('PER_VISIT', 'HOURLY');

-- CreateTable
CREATE TABLE "cleaning"."Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" "cleaning"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Estimate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "siteName" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "frequency" "cleaning"."ServiceFrequency" NOT NULL DEFAULT 'WEEKLY',
    "pricing" "cleaning"."EstimatePricing" NOT NULL DEFAULT 'PER_VISIT',
    "rate" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "checklistTemplateId" TEXT,
    "status" "cleaning"."EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "convertedCustomerId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."EstimateLine" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "cleaning"."Lead"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "cleaning"."Lead"("status");

-- CreateIndex
CREATE INDEX "Estimate_organizationId_idx" ON "cleaning"."Estimate"("organizationId");

-- CreateIndex
CREATE INDEX "Estimate_leadId_idx" ON "cleaning"."Estimate"("leadId");

-- CreateIndex
CREATE INDEX "Estimate_customerId_idx" ON "cleaning"."Estimate"("customerId");

-- CreateIndex
CREATE INDEX "Estimate_status_idx" ON "cleaning"."Estimate"("status");

-- CreateIndex
CREATE INDEX "EstimateLine_estimateId_idx" ON "cleaning"."EstimateLine"("estimateId");

-- AddForeignKey
ALTER TABLE "cleaning"."Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Estimate" ADD CONSTRAINT "Estimate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Estimate" ADD CONSTRAINT "Estimate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "cleaning"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Estimate" ADD CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Estimate" ADD CONSTRAINT "Estimate_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "cleaning"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Estimate" ADD CONSTRAINT "Estimate_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "cleaning"."ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EstimateLine" ADD CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "cleaning"."Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

