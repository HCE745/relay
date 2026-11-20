-- P1: Task Ownership & Verification — schema foundations.
--
-- Purely ADDITIVE and safe to run on a live database:
--   * Five new JobChecklistItem columns: assignedToId, verificationStatus (NOT
--     NULL default 'ASSIGNED'), verifierId, verifiedAt, verificationNote,
--     rejectionReason. The default is a constant, so existing rows are left
--     unchanged and the add is a fast metadata-only change (no table rewrite).
--   * One new Organization column, peerVerificationEnabled (NOT NULL default
--     false) — opting into peer verification is off until a company enables it.
--   * A new ChecklistItemAssignee table for shared task ownership.
--   * Foreign keys to User are ON DELETE SET NULL (assignedTo/verifier) or
--     CASCADE (assignee rows), matching the Prisma relations.
--
-- Adding these does NOT activate any enforcement or change any existing
-- behavior: no NOT-NULL backfill of nullable columns, no drops, no data edits.
-- Existing checklist items default to verificationStatus 'ASSIGNED' with no
-- owner/verifier, which the application treats exactly like today's items.

-- CreateEnum
CREATE TYPE "cleaning"."TaskVerificationStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED_AWAITING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CORRECTED_AWAITING_REINSPECTION');

-- AlterTable
ALTER TABLE "cleaning"."JobChecklistItem" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationStatus" "cleaning"."TaskVerificationStatus" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifierId" TEXT;

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "peerVerificationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cleaning"."ChecklistItemAssignee" (
    "id" TEXT NOT NULL,
    "jobChecklistItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItemAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistItemAssignee_userId_idx" ON "cleaning"."ChecklistItemAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemAssignee_jobChecklistItemId_userId_key" ON "cleaning"."ChecklistItemAssignee"("jobChecklistItemId", "userId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_assignedToId_idx" ON "cleaning"."JobChecklistItem"("assignedToId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_verificationStatus_idx" ON "cleaning"."JobChecklistItem"("verificationStatus");

-- AddForeignKey
ALTER TABLE "cleaning"."JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ChecklistItemAssignee" ADD CONSTRAINT "ChecklistItemAssignee_jobChecklistItemId_fkey" FOREIGN KEY ("jobChecklistItemId") REFERENCES "cleaning"."JobChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ChecklistItemAssignee" ADD CONSTRAINT "ChecklistItemAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
