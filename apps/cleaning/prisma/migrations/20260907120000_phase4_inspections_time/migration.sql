-- CreateEnum
CREATE TYPE "cleaning"."InspectionStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "cleaning"."InspectionOutcome" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "cleaning"."InspectionResultValue" AS ENUM ('PASS', 'FAIL', 'NA');

-- AlterTable
ALTER TABLE "cleaning"."Issue" ADD COLUMN     "inspectionId" TEXT;

-- AlterTable
ALTER TABLE "cleaning"."JobPhoto" ADD COLUMN     "inspectionId" TEXT,
ADD COLUMN     "inspectionItemResultId" TEXT,
ALTER COLUMN "jobId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cleaning"."InspectionTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passThreshold" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "requirePhoto" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Inspection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "jobId" TEXT,
    "inspectorId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "passThreshold" INTEGER NOT NULL,
    "status" "cleaning"."InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "score" DOUBLE PRECISION,
    "outcome" "cleaning"."InspectionOutcome",
    "comments" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."InspectionItemResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "points" INTEGER NOT NULL,
    "isCritical" BOOLEAN NOT NULL,
    "requirePhoto" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "result" "cleaning"."InspectionResultValue",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionItemResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InspectionTemplate_organizationId_idx" ON "cleaning"."InspectionTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "InspectionTemplateItem_templateId_idx" ON "cleaning"."InspectionTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_idx" ON "cleaning"."Inspection"("organizationId");

-- CreateIndex
CREATE INDEX "Inspection_serviceLocationId_idx" ON "cleaning"."Inspection"("serviceLocationId");

-- CreateIndex
CREATE INDEX "Inspection_jobId_idx" ON "cleaning"."Inspection"("jobId");

-- CreateIndex
CREATE INDEX "InspectionItemResult_inspectionId_idx" ON "cleaning"."InspectionItemResult"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_inspectionId_key" ON "cleaning"."Issue"("inspectionId");

-- CreateIndex
CREATE INDEX "JobPhoto_inspectionId_idx" ON "cleaning"."JobPhoto"("inspectionId");

-- AddForeignKey
ALTER TABLE "cleaning"."TimeEntry" ADD CONSTRAINT "TimeEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "cleaning"."Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_inspectionItemResultId_fkey" FOREIGN KEY ("inspectionItemResultId") REFERENCES "cleaning"."InspectionItemResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "cleaning"."Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "cleaning"."InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Inspection" ADD CONSTRAINT "Inspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Inspection" ADD CONSTRAINT "Inspection_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Inspection" ADD CONSTRAINT "Inspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Inspection" ADD CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "cleaning"."InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InspectionItemResult" ADD CONSTRAINT "InspectionItemResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "cleaning"."Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

