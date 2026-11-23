-- Phase 46: Help & feedback, scheduled/recurring inspections, and enriched
-- service-area exclusions (incident linkage, occupant-change workflow, lifecycle
-- + audit trail) with customer archiving fields.
--
-- Purely ADDITIVE and safe on a live database: new enums + tables, and new
-- nullable/defaulted columns on ExcludedAddress and Customer. No drops, no
-- NOT-NULL backfills, no data edits. Existing behavior is unchanged until the
-- new UI/cron use these columns.

-- CreateEnum
CREATE TYPE "cleaning"."InspectionCadence" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "cleaning"."FeedbackType" AS ENUM ('BUG', 'FEATURE', 'QUESTION');

-- CreateEnum
CREATE TYPE "cleaning"."FeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "cleaning"."FeedbackAttachmentKind" AS ENUM ('SCREENSHOT', 'RECORDING', 'UPLOAD');

-- CreateEnum
CREATE TYPE "cleaning"."ExclusionStatus" AS ENUM ('ACTIVE', 'LIFTED');

-- CreateEnum
CREATE TYPE "cleaning"."ExclusionEventType" AS ENUM ('CREATED', 'NOTE', 'OCCUPANT_CHANGE', 'LIFTED', 'REINSTATED');

-- AlterTable
ALTER TABLE "cleaning"."Customer" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "cleaning"."ExcludedAddress" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerNameSnapshot" TEXT,
ADD COLUMN     "incidentDate" TIMESTAMP(3),
ADD COLUMN     "isPropertySpecific" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liftReason" TEXT,
ADD COLUMN     "liftedAt" TIMESTAMP(3),
ADD COLUMN     "liftedById" TEXT,
ADD COLUMN     "occupantChangeVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "occupantEmail" TEXT,
ADD COLUMN     "occupantName" TEXT,
ADD COLUMN     "occupantPhone" TEXT,
ADD COLUMN     "serviceLocationId" TEXT,
ADD COLUMN     "status" "cleaning"."ExclusionStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "cleaning"."ScheduledInspection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "cadence" "cleaning"."InspectionCadence" NOT NULL DEFAULT 'ONCE',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "reminderLeadHours" INTEGER NOT NULL DEFAULT 24,
    "reminderSentForRunAt" TIMESTAMP(3),
    "randomizeInspector" BOOLEAN NOT NULL DEFAULT false,
    "inspectorPoolIds" TEXT[],
    "assignedInspectorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "cleaning"."FeedbackType" NOT NULL,
    "status" "cleaning"."FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "consentVisual" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."FeedbackAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" "cleaning"."FeedbackAttachmentKind" NOT NULL,
    "storageRef" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ExclusionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "excludedAddressId" TEXT NOT NULL,
    "type" "cleaning"."ExclusionEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "note" TEXT,
    "occupantName" TEXT,
    "occupantPhone" TEXT,
    "occupantEmail" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExclusionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledInspection_organizationId_idx" ON "cleaning"."ScheduledInspection"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledInspection_active_nextRunAt_idx" ON "cleaning"."ScheduledInspection"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_organizationId_idx" ON "cleaning"."FeedbackSubmission"("organizationId");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_organizationId_status_idx" ON "cleaning"."FeedbackSubmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FeedbackAttachment_submissionId_idx" ON "cleaning"."FeedbackAttachment"("submissionId");

-- CreateIndex
CREATE INDEX "ExclusionEvent_excludedAddressId_idx" ON "cleaning"."ExclusionEvent"("excludedAddressId");

-- CreateIndex
CREATE INDEX "ExcludedAddress_customerId_idx" ON "cleaning"."ExcludedAddress"("customerId");

-- CreateIndex
CREATE INDEX "ExcludedAddress_serviceLocationId_idx" ON "cleaning"."ExcludedAddress"("serviceLocationId");

-- AddForeignKey
ALTER TABLE "cleaning"."ScheduledInspection" ADD CONSTRAINT "ScheduledInspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ScheduledInspection" ADD CONSTRAINT "ScheduledInspection_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ScheduledInspection" ADD CONSTRAINT "ScheduledInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "cleaning"."InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."FeedbackAttachment" ADD CONSTRAINT "FeedbackAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "cleaning"."FeedbackSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExcludedAddress" ADD CONSTRAINT "ExcludedAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExcludedAddress" ADD CONSTRAINT "ExcludedAddress_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ExclusionEvent" ADD CONSTRAINT "ExclusionEvent_excludedAddressId_fkey" FOREIGN KEY ("excludedAddressId") REFERENCES "cleaning"."ExcludedAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

