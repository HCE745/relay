-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "ai_confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN     "ai_suggest_unmatched_items" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approval_intelligence_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "aiDamageAssessment" TEXT,
ADD COLUMN     "aiItemIdentified" TEXT,
ADD COLUMN     "aiMatchConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiReasoning" TEXT,
ADD COLUMN     "approvalPath" TEXT,
ADD COLUMN     "approvalPolicyId" TEXT,
ADD COLUMN     "approvalPolicyRuleId" TEXT,
ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "currentApproverRole" TEXT,
ADD COLUMN     "infoRequestMessage" TEXT,
ADD COLUMN     "photoData" JSONB,
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "replacementUrl" TEXT,
ADD COLUMN     "vendorSku" TEXT;

-- CreateTable
CREATE TABLE "ApprovedCatalogItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "preferredVendorId" TEXT,
    "vendorSku" TEXT,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "replacementUrl" TEXT,
    "approvalPolicyId" TEXT,
    "autoApproveBelow" DOUBLE PRECISION,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovedCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovedCatalogItemSubstitute" (
    "baseItemId" TEXT NOT NULL,
    "substituteItemId" TEXT NOT NULL,

    CONSTRAINT "ApprovedCatalogItemSubstitute_pkey" PRIMARY KEY ("baseItemId","substituteItemId")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "escalateAfterHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicyRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "category" TEXT,
    "departmentId" TEXT,
    "locationId" TEXT,
    "vendorId" TEXT,
    "approvalPath" TEXT NOT NULL,
    "escalateAfterHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestApproval" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "overrideItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovedCatalogItem_organizationId_idx" ON "ApprovedCatalogItem"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovedCatalogItem_category_idx" ON "ApprovedCatalogItem"("category");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_organizationId_idx" ON "ApprovalPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalPolicyRule_policyId_idx" ON "ApprovalPolicyRule"("policyId");

-- CreateIndex
CREATE INDEX "ApprovalPolicyRule_priority_idx" ON "ApprovalPolicyRule"("priority");

-- CreateIndex
CREATE INDEX "PurchaseRequestApproval_purchaseRequestId_idx" ON "PurchaseRequestApproval"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_referenceNumber_key" ON "PurchaseRequest"("referenceNumber");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ApprovedCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedCatalogItem" ADD CONSTRAINT "ApprovedCatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedCatalogItem" ADD CONSTRAINT "ApprovedCatalogItem_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedCatalogItem" ADD CONSTRAINT "ApprovedCatalogItem_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedCatalogItemSubstitute" ADD CONSTRAINT "ApprovedCatalogItemSubstitute_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "ApprovedCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedCatalogItemSubstitute" ADD CONSTRAINT "ApprovedCatalogItemSubstitute_substituteItemId_fkey" FOREIGN KEY ("substituteItemId") REFERENCES "ApprovedCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicyRule" ADD CONSTRAINT "ApprovalPolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_overrideItemId_fkey" FOREIGN KEY ("overrideItemId") REFERENCES "ApprovedCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

