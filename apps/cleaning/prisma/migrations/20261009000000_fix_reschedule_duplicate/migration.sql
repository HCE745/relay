-- Fix the reschedule-duplicate bug: make occurrence identity immutable.
-- A plan Job is now keyed on plannedStart (the original recurrence instant),
-- not scheduledStart (which a reschedule moves). This prevents the generator
-- from recreating a ghost in a vacated slot.

-- 1. Add the immutable occurrence anchor (nullable; manual jobs stay NULL).
ALTER TABLE "cleaning"."Job" ADD COLUMN "plannedStart" TIMESTAMP(3);

-- 2. Backfill: existing plan-generated jobs anchor to their current scheduledStart.
--    (These are already unique per plan under the old constraint, so the new
--    unique index below will build cleanly.)
UPDATE "cleaning"."Job" SET "plannedStart" = "scheduledStart" WHERE "servicePlanId" IS NOT NULL;

-- 3. Swap the uniqueness guarantee from the mutable column to the immutable one.
DROP INDEX "cleaning"."Job_servicePlanId_scheduledStart_key";
CREATE UNIQUE INDEX "Job_servicePlanId_plannedStart_key" ON "cleaning"."Job"("servicePlanId", "plannedStart");
