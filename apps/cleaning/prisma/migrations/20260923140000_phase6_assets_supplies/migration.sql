-- CreateEnum
CREATE TYPE "cleaning"."AssetCategory" AS ENUM ('EQUIPMENT', 'VEHICLE', 'MACHINE');

-- CreateEnum
CREATE TYPE "cleaning"."AssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "cleaning"."Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "cleaning"."AssetCategory" NOT NULL DEFAULT 'EQUIPMENT',
    "serial" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(12,2),
    "status" "cleaning"."AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedToSiteId" TEXT,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."AssetMaintenance" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Supply" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "currentStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderThreshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costPerUnit" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."SupplyUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "jobId" TEXT,
    "serviceLocationId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."SupplyAdjustment" (
    "id" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "delta" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_organizationId_idx" ON "cleaning"."Asset"("organizationId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "cleaning"."Asset"("status");

-- CreateIndex
CREATE INDEX "AssetMaintenance_assetId_idx" ON "cleaning"."AssetMaintenance"("assetId");

-- CreateIndex
CREATE INDEX "Supply_organizationId_idx" ON "cleaning"."Supply"("organizationId");

-- CreateIndex
CREATE INDEX "SupplyUsage_organizationId_idx" ON "cleaning"."SupplyUsage"("organizationId");

-- CreateIndex
CREATE INDEX "SupplyUsage_supplyId_idx" ON "cleaning"."SupplyUsage"("supplyId");

-- CreateIndex
CREATE INDEX "SupplyUsage_jobId_idx" ON "cleaning"."SupplyUsage"("jobId");

-- CreateIndex
CREATE INDEX "SupplyAdjustment_supplyId_idx" ON "cleaning"."SupplyAdjustment"("supplyId");

-- AddForeignKey
ALTER TABLE "cleaning"."Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Asset" ADD CONSTRAINT "Asset_assignedToSiteId_fkey" FOREIGN KEY ("assignedToSiteId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Asset" ADD CONSTRAINT "Asset_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "cleaning"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Supply" ADD CONSTRAINT "Supply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyUsage" ADD CONSTRAINT "SupplyUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyUsage" ADD CONSTRAINT "SupplyUsage_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyUsage" ADD CONSTRAINT "SupplyUsage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyUsage" ADD CONSTRAINT "SupplyUsage_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyUsage" ADD CONSTRAINT "SupplyUsage_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyAdjustment" ADD CONSTRAINT "SupplyAdjustment_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."SupplyAdjustment" ADD CONSTRAINT "SupplyAdjustment_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

