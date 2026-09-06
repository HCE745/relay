-- CreateEnum
CREATE TYPE "cleaning"."IssueCategory" AS ENUM ('QUALITY', 'SAFETY', 'EQUIPMENT', 'SUPPLIES', 'ACCESS', 'CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "cleaning"."IssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "cleaning"."Job" DROP COLUMN "photos";

-- AlterTable
ALTER TABLE "cleaning"."JobChecklistItem" DROP COLUMN "photos";

-- CreateTable
CREATE TABLE "cleaning"."JobPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobChecklistItemId" TEXT,
    "issueId" TEXT,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Issue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "serviceLocationId" TEXT,
    "reportedById" TEXT NOT NULL,
    "category" "cleaning"."IssueCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "description" TEXT NOT NULL,
    "status" "cleaning"."IssueStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPhoto_organizationId_idx" ON "cleaning"."JobPhoto"("organizationId");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_idx" ON "cleaning"."JobPhoto"("jobId");

-- CreateIndex
CREATE INDEX "JobPhoto_jobChecklistItemId_idx" ON "cleaning"."JobPhoto"("jobChecklistItemId");

-- CreateIndex
CREATE INDEX "Issue_organizationId_idx" ON "cleaning"."Issue"("organizationId");

-- CreateIndex
CREATE INDEX "Issue_jobId_idx" ON "cleaning"."Issue"("jobId");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "cleaning"."Issue"("status");

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_jobChecklistItemId_fkey" FOREIGN KEY ("jobChecklistItemId") REFERENCES "cleaning"."JobChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "cleaning"."Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

