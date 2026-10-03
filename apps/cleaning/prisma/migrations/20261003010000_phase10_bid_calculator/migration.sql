-- AlterTable
ALTER TABLE "cleaning"."Estimate" ADD COLUMN     "bidWorksheet" JSONB;

-- CreateTable
CREATE TABLE "cleaning"."ProductionRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "surfaceType" TEXT NOT NULL,
    "sqftPerHour" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionRate_organizationId_idx" ON "cleaning"."ProductionRate"("organizationId");

-- AddForeignKey
ALTER TABLE "cleaning"."ProductionRate" ADD CONSTRAINT "ProductionRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
