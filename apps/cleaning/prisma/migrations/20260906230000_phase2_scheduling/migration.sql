-- AlterTable
ALTER TABLE "cleaning"."Job" ADD COLUMN     "crewSize" INTEGER;

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

-- AlterTable
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN     "startTime" TEXT;

-- CreateIndex
CREATE INDEX "Job_scheduledStart_idx" ON "cleaning"."Job"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "Job_servicePlanId_scheduledStart_key" ON "cleaning"."Job"("servicePlanId", "scheduledStart");

