-- AlterTable SalesUser: add employment status and commission fields
ALTER TABLE "SalesUser" ADD COLUMN "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "SalesUser" ADD COLUMN "inactiveAt" TIMESTAMP(3);
ALTER TABLE "SalesUser" ADD COLUMN "commissionEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SalesUser" ADD COLUMN "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 33.00;

-- AlterTable CrmOpportunity: add commission and attribution fields
ALTER TABLE "CrmOpportunity" ADD COLUMN "customerOrganizationId" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN "closedById" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "CrmOpportunity" ADD COLUMN "commissionEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CrmOpportunity" ADD COLUMN "leadSource" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN "sourceDetail" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN "estimatedValue" DECIMAL(12,2);

-- AddForeignKey CrmOpportunity.closedById -> SalesUser
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "SalesUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index CrmOpportunity.customerOrganizationId
CREATE INDEX "CrmOpportunity_customerOrganizationId_idx" ON "CrmOpportunity"("customerOrganizationId");

-- CreateTable CommissionAttribution
CREATE TABLE "CommissionAttribution" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "commissionOwnerId" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 33.00,
    "attributionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "attributionApprovedById" TEXT,
    "attributionApprovedAt" TIMESTAMP(3),
    "attributionReason" TEXT NOT NULL DEFAULT 'NORMAL_CLOSE',
    "attributionLockedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommissionAttribution_opportunityId_key" ON "CommissionAttribution"("opportunityId");
CREATE INDEX "CommissionAttribution_commissionOwnerId_idx" ON "CommissionAttribution"("commissionOwnerId");
CREATE INDEX "CommissionAttribution_attributionStatus_idx" ON "CommissionAttribution"("attributionStatus");

-- AddForeignKey CommissionAttribution.opportunityId -> CrmOpportunity
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CommissionAttribution.commissionOwnerId -> SalesUser
ALTER TABLE "CommissionAttribution" ADD CONSTRAINT "CommissionAttribution_commissionOwnerId_fkey"
  FOREIGN KEY ("commissionOwnerId") REFERENCES "SalesUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable CommissionPayment
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "grossRevenue" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "commissionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "commissionPaidAt" TIMESTAMP(3),
    "paymentReceivedAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionPayment_attributionId_idx" ON "CommissionPayment"("attributionId");
CREATE INDEX "CommissionPayment_commissionStatus_idx" ON "CommissionPayment"("commissionStatus");

-- AddForeignKey CommissionPayment.attributionId -> CommissionAttribution
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_attributionId_fkey"
  FOREIGN KEY ("attributionId") REFERENCES "CommissionAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable AccountAssignmentHistory
CREATE TABLE "AccountAssignmentHistory" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "previousOwnerId" TEXT,
    "newOwnerId" TEXT,
    "changedById" TEXT NOT NULL,
    "changedByType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAssignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountAssignmentHistory_recordType_recordId_idx" ON "AccountAssignmentHistory"("recordType", "recordId");
CREATE INDEX "AccountAssignmentHistory_newOwnerId_idx" ON "AccountAssignmentHistory"("newOwnerId");
