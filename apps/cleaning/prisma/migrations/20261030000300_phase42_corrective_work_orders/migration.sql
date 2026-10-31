-- Phase 42: automatic corrective work orders. A failed inspection can
-- auto-create a NON-billable corrective work order, linked to the inspection,
-- with a severity-derived due date and a resolver/verifier split.

ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "isCorrective" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "inspectionId" TEXT;
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "resolvedById" TEXT;
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "verifiedById" TEXT;
ALTER TABLE "cleaning"."WorkOrder" ADD COLUMN "verifiedAt" TIMESTAMP(3);
CREATE INDEX "WorkOrder_inspectionId_idx" ON "cleaning"."WorkOrder"("inspectionId");
ALTER TABLE "cleaning"."WorkOrder" ADD CONSTRAINT "WorkOrder_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "cleaning"."Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Org-configurable corrective rule.
ALTER TABLE "cleaning"."Organization" ADD COLUMN "autoCorrectiveWorkOrders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."Organization" ADD COLUMN "correctiveOnCriticalOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."Organization" ADD COLUMN "correctiveDueDaysStandard" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "cleaning"."Organization" ADD COLUMN "correctiveDueDaysCritical" INTEGER NOT NULL DEFAULT 1;
