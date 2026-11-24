-- CreateEnum
CREATE TYPE "cleaning"."SupplyKind" AS ENUM ('CONSUMABLE', 'REUSABLE', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "cleaning"."InventoryLocationKind" AS ENUM ('WAREHOUSE', 'SUPPLY_STATION', 'CUSTOMER_SITE', 'VEHICLE', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "cleaning"."StockTxnType" AS ENUM ('RECEIPT', 'TRANSFER', 'CONSUMPTION', 'ADJUSTMENT', 'LOSS', 'DAMAGE', 'RETURN_CLEAN', 'RETURN_DIRTY', 'LAUNDERED');

-- CreateEnum
CREATE TYPE "cleaning"."ReplenishmentStatus" AS ENUM ('OPEN', 'APPROVED', 'FULFILLED', 'DECLINED', 'CLOSED');

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "invAutoEstimate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invRequireManualUsage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invTrackLocations" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cleaning"."Supply" ADD COLUMN     "kind" "cleaning"."SupplyKind" NOT NULL DEFAULT 'CONSUMABLE',
ADD COLUMN     "purchaseUnit" TEXT,
ADD COLUMN     "stockPerUsage" DECIMAL(12,4),
ADD COLUMN     "trackByLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitsPerPurchase" DECIMAL(12,4),
ADD COLUMN     "usageUnit" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."InventoryLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "cleaning"."InventoryLocationKind" NOT NULL DEFAULT 'WAREHOUSE',
    "serviceLocationId" TEXT,
    "holderUserId" TEXT,
    "qrToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."StockLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "inventoryLocationId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dirtyQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minLevel" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."StockTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "type" "cleaning"."StockTxnType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "actorUserId" TEXT,
    "jobId" TEXT,
    "note" TEXT,
    "isEstimated" BOOLEAN NOT NULL DEFAULT false,
    "costPerUnit" DECIMAL(12,2),
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ExpectedSupplyUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "checklistTemplateId" TEXT,
    "servicePlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedSupplyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT,
    "inventoryLocationId" TEXT,
    "requestedById" TEXT NOT NULL,
    "quantity" DECIMAL(12,2),
    "note" TEXT,
    "status" "cleaning"."ReplenishmentStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_qrToken_key" ON "cleaning"."InventoryLocation"("qrToken");

-- CreateIndex
CREATE INDEX "InventoryLocation_organizationId_idx" ON "cleaning"."InventoryLocation"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryLocation_kind_idx" ON "cleaning"."InventoryLocation"("kind");

-- CreateIndex
CREATE INDEX "StockLevel_organizationId_idx" ON "cleaning"."StockLevel"("organizationId");

-- CreateIndex
CREATE INDEX "StockLevel_inventoryLocationId_idx" ON "cleaning"."StockLevel"("inventoryLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_supplyId_inventoryLocationId_key" ON "cleaning"."StockLevel"("supplyId", "inventoryLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransaction_sourceKey_key" ON "cleaning"."StockTransaction"("sourceKey");

-- CreateIndex
CREATE INDEX "StockTransaction_organizationId_idx" ON "cleaning"."StockTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "StockTransaction_supplyId_idx" ON "cleaning"."StockTransaction"("supplyId");

-- CreateIndex
CREATE INDEX "StockTransaction_jobId_idx" ON "cleaning"."StockTransaction"("jobId");

-- CreateIndex
CREATE INDEX "StockTransaction_createdAt_idx" ON "cleaning"."StockTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "ExpectedSupplyUsage_organizationId_idx" ON "cleaning"."ExpectedSupplyUsage"("organizationId");

-- CreateIndex
CREATE INDEX "ExpectedSupplyUsage_checklistTemplateId_idx" ON "cleaning"."ExpectedSupplyUsage"("checklistTemplateId");

-- CreateIndex
CREATE INDEX "ExpectedSupplyUsage_servicePlanId_idx" ON "cleaning"."ExpectedSupplyUsage"("servicePlanId");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_organizationId_idx" ON "cleaning"."ReplenishmentRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_status_idx" ON "cleaning"."ReplenishmentRequest"("status");

-- AddForeignKey
ALTER TABLE "cleaning"."InventoryLocation" ADD CONSTRAINT "InventoryLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InventoryLocation" ADD CONSTRAINT "InventoryLocation_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InventoryLocation" ADD CONSTRAINT "InventoryLocation_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockLevel" ADD CONSTRAINT "StockLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockLevel" ADD CONSTRAINT "StockLevel_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockLevel" ADD CONSTRAINT "StockLevel_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "cleaning"."InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "cleaning"."InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "cleaning"."InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."StockTransaction" ADD CONSTRAINT "StockTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExpectedSupplyUsage" ADD CONSTRAINT "ExpectedSupplyUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExpectedSupplyUsage" ADD CONSTRAINT "ExpectedSupplyUsage_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExpectedSupplyUsage" ADD CONSTRAINT "ExpectedSupplyUsage_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "cleaning"."ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExpectedSupplyUsage" ADD CONSTRAINT "ExpectedSupplyUsage_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "cleaning"."ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "cleaning"."Supply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "cleaning"."InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

