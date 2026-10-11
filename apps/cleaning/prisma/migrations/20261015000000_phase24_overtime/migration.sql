-- Phase 24: overtime & labor rules. Additive.
ALTER TABLE "cleaning"."Organization"
  ADD COLUMN "otWeeklyThresholdHours" INTEGER DEFAULT 40,
  ADD COLUMN "otDailyThresholdHours" INTEGER,
  ADD COLUMN "otMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5;
