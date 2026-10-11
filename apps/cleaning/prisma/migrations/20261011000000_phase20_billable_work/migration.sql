-- Phase 20: billable one-time & extra work. Additive.

-- CreateEnum
CREATE TYPE "cleaning"."WorkOrderType" AS ENUM ('EMERGENCY', 'ONE_TIME', 'ADDITIONAL', 'DEEP_CLEAN');
CREATE TYPE "cleaning"."WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "cleaning"."WorkOrderStatus" AS ENUM ('REQUESTED', 'QUOTED', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'DECLINED');
CREATE TYPE "cleaning"."ChangeOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable: per-job billing for manual jobs
ALTER TABLE "cleaning"."Job"
  ADD COLUMN "billingType" "cleaning"."BillingType",
  ADD COLUMN "rate" DECIMAL(12,2),
  ADD COLUMN "currency" TEXT;

-- AlterTable: change-order claim on invoice lines
ALTER TABLE "cleaning"."InvoiceLine"
  ADD COLUMN "changeOrderId" TEXT,
  ADD COLUMN "activeChangeOrderId" TEXT;
CREATE UNIQUE INDEX "InvoiceLine_activeChangeOrderId_key" ON "cleaning"."InvoiceLine"("activeChangeOrderId");

-- CreateTable: WorkOrder
CREATE TABLE "cleaning"."WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceLocationId" TEXT,
    "type" "cleaning"."WorkOrderType" NOT NULL,
    "description" TEXT NOT NULL,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" "cleaning"."WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "quotedAmount" DECIMAL(12,2),
    "status" "cleaning"."WorkOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "issueId" TEXT,
    "convertedJobId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkOrder_issueId_key" ON "cleaning"."WorkOrder"("issueId");
CREATE UNIQUE INDEX "WorkOrder_convertedJobId_key" ON "cleaning"."WorkOrder"("convertedJobId");
CREATE INDEX "WorkOrder_organizationId_idx" ON "cleaning"."WorkOrder"("organizationId");
CREATE INDEX "WorkOrder_status_idx" ON "cleaning"."WorkOrder"("status");

-- CreateTable: ChangeOrder
CREATE TABLE "cleaning"."ChangeOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "contractId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "requiresCustomerApproval" BOOLEAN NOT NULL DEFAULT true,
    "status" "cleaning"."ChangeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedByPortal" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChangeOrder_organizationId_idx" ON "cleaning"."ChangeOrder"("organizationId");
CREATE INDEX "ChangeOrder_status_idx" ON "cleaning"."ChangeOrder"("status");
CREATE INDEX "ChangeOrder_jobId_idx" ON "cleaning"."ChangeOrder"("jobId");

-- Foreign keys
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "cleaning"."Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_convertedJobId_fkey" FOREIGN KEY ("convertedJobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ChangeOrder" ADD CONSTRAINT "ChangeOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ChangeOrder" ADD CONSTRAINT "ChangeOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ChangeOrder" ADD CONSTRAINT "ChangeOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "cleaning"."Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
