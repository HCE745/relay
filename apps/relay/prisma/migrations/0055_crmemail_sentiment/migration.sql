-- Add sentiment classification field to CrmEmail
-- Allows sales reps to manually classify received emails as positive, neutral, or negative
-- Used to calculate positive reply rate in manager analytics

ALTER TABLE "CrmEmail" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;
