-- P3: Customer complaint linkage, investigation & corrective work.
--
-- Purely ADDITIVE and safe on a live database. Customer complaints remain the
-- existing Issue (source = CUSTOMER); this does NOT create a second complaint
-- system. It layers investigation on top:
--   * Issue gains a checklist-item link (jobChecklistItemId) and an investigation
--     result (outcome / finding / investigatedBy / investigatedAt). `outcome` is
--     orthogonal to the SLA `status` machine — a complaint is an allegation until
--     an outcome is recorded, and only a SUBSTANTIATED outcome may ever feed
--     performance analytics.
--   * WorkOrder gains assignedToId so corrective rework can be assigned to (and
--     tracked for) a specific employee, reusing the existing corrective WO flow.
--   * ComplaintResponsibility: an IMMUTABLE snapshot of who was responsible for
--     the work (original assignment incl. shared co-owners via isPrimary,
--     completion, verification), captured at investigation time so history
--     survives later edits to the live job.
--   * One neutral notification event (CORRECTIVE_ASSIGNED) for the assignee.
--   * Two enums, indexes, and foreign keys. No drops, no NOT-NULL backfills, no
--     data edits. Adding these changes no existing behavior.
--
-- NOTE: ALTER TYPE ... ADD VALUE on NotificationEvent is safe here — PostgreSQL
-- 12+ permits it inside a transaction as long as the new value is not USED in the
-- same transaction (it isn't; no rows are written with it).

-- CreateEnum
CREATE TYPE "cleaning"."IssueOutcome" AS ENUM ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE');
-- CreateEnum
CREATE TYPE "cleaning"."ComplaintResponsibilityBasis" AS ENUM ('TASK_ASSIGNEE', 'TASK_COMPLETER', 'TASK_VERIFIER', 'JOB_ASSIGNEE');
-- AlterEnum
ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE 'CORRECTIVE_ASSIGNED';
-- AlterTable
ALTER TABLE "cleaning"."Issue" ADD COLUMN     "finding" TEXT,
ADD COLUMN     "investigatedAt" TIMESTAMP(3),
ADD COLUMN     "investigatedById" TEXT,
ADD COLUMN     "jobChecklistItemId" TEXT,
ADD COLUMN     "outcome" "cleaning"."IssueOutcome";
-- AlterTable
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN     "assignedToId" TEXT;
-- CreateTable
CREATE TABLE "cleaning"."ComplaintResponsibility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basis" "cleaning"."ComplaintResponsibilityBasis" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "jobChecklistItemId" TEXT,
    "taskLabel" TEXT,
    "verificationStatus" TEXT,
    "completedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT,
    CONSTRAINT "ComplaintResponsibility_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ComplaintResponsibility_organizationId_idx" ON "cleaning"."ComplaintResponsibility"("organizationId");
-- CreateIndex
CREATE INDEX "ComplaintResponsibility_issueId_idx" ON "cleaning"."ComplaintResponsibility"("issueId");
-- CreateIndex
CREATE INDEX "ComplaintResponsibility_userId_idx" ON "cleaning"."ComplaintResponsibility"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "ComplaintResponsibility_issueId_userId_basis_jobChecklistIt_key" ON "cleaning"."ComplaintResponsibility"("issueId", "userId", "basis", "jobChecklistItemId");
-- CreateIndex
CREATE INDEX "Issue_jobChecklistItemId_idx" ON "cleaning"."Issue"("jobChecklistItemId");
-- CreateIndex
CREATE INDEX "WorkOrder_assignedToId_idx" ON "cleaning"."WorkOrder"("assignedToId");
-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_jobChecklistItemId_fkey" FOREIGN KEY ("jobChecklistItemId") REFERENCES "cleaning"."JobChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_investigatedById_fkey" FOREIGN KEY ("investigatedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."ComplaintResponsibility" ADD CONSTRAINT "ComplaintResponsibility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."ComplaintResponsibility" ADD CONSTRAINT "ComplaintResponsibility_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "cleaning"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."ComplaintResponsibility" ADD CONSTRAINT "ComplaintResponsibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cleaning"."ComplaintResponsibility" ADD CONSTRAINT "ComplaintResponsibility_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
