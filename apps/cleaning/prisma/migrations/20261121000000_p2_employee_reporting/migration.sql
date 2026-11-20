-- P2: Employee reporting & supervisor review — schema foundations.
--
-- Purely ADDITIVE and safe to run on a live database:
--   * Four new enums (EmployeeReportCategory / Confidentiality / Status / Outcome).
--   * One new table, EmployeeReport (employee-filed work-quality, operational,
--     and confidential workplace reports + investigation workflow).
--   * One new nullable column on JobPhoto, employeeReportId, so evidence reuses
--     the existing photo store. Report evidence carries NO jobId, so it never
--     appears in a job's proof-of-service gallery; the serve route additionally
--     authorizes by report access.
--   * Indexes + foreign keys. User FKs are ON DELETE SET NULL (subject/reviewer/
--     resolver/corrective assignee) or RESTRICT (the required reporter); the
--     JobPhoto->EmployeeReport FK is ON DELETE CASCADE (evidence dies with the
--     report). No drops, no NOT-NULL backfills, no data edits.
--
-- Adding these does NOT activate any enforcement or change existing behavior.


-- CreateEnum
CREATE TYPE "cleaning"."EmployeeReportCategory" AS ENUM ('INCOMPLETE_WORK', 'MISSED_TASK', 'POOR_WORKMANSHIP', 'QUALITY_OTHER', 'ASSIGNMENT_REFUSAL', 'LEFT_EARLY', 'PROCEDURE_VIOLATION', 'OPERATIONAL_OTHER', 'HARASSMENT', 'THEFT', 'THREAT', 'SAFETY_CONCERN', 'MISCONDUCT_OTHER');

-- CreateEnum
CREATE TYPE "cleaning"."EmployeeReportConfidentiality" AS ENUM ('NORMAL', 'PRIVATE', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "cleaning"."EmployeeReportStatus" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "cleaning"."EmployeeReportOutcome" AS ENUM ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE');

-- AlterTable
ALTER TABLE "cleaning"."JobPhoto" ADD COLUMN     "employeeReportId" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."EmployeeReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "aboutUserId" TEXT,
    "jobId" TEXT,
    "jobChecklistItemId" TEXT,
    "category" "cleaning"."EmployeeReportCategory" NOT NULL,
    "confidentiality" "cleaning"."EmployeeReportConfidentiality" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT,
    "description" TEXT NOT NULL,
    "status" "cleaning"."EmployeeReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "outcome" "cleaning"."EmployeeReportOutcome",
    "reviewerId" TEXT,
    "reviewStartedAt" TIMESTAMP(3),
    "finding" TEXT,
    "employeeResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "correctiveAction" TEXT,
    "correctiveDueAt" TIMESTAMP(3),
    "correctiveAssigneeId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeReport_organizationId_idx" ON "cleaning"."EmployeeReport"("organizationId");

-- CreateIndex
CREATE INDEX "EmployeeReport_organizationId_status_idx" ON "cleaning"."EmployeeReport"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EmployeeReport_aboutUserId_idx" ON "cleaning"."EmployeeReport"("aboutUserId");

-- CreateIndex
CREATE INDEX "EmployeeReport_reportedById_idx" ON "cleaning"."EmployeeReport"("reportedById");

-- CreateIndex
CREATE INDEX "JobPhoto_employeeReportId_idx" ON "cleaning"."JobPhoto"("employeeReportId");

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_aboutUserId_fkey" FOREIGN KEY ("aboutUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_correctiveAssigneeId_fkey" FOREIGN KEY ("correctiveAssigneeId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeReport" ADD CONSTRAINT "EmployeeReport_jobChecklistItemId_fkey" FOREIGN KEY ("jobChecklistItemId") REFERENCES "cleaning"."JobChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobPhoto" ADD CONSTRAINT "JobPhoto_employeeReportId_fkey" FOREIGN KEY ("employeeReportId") REFERENCES "cleaning"."EmployeeReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

