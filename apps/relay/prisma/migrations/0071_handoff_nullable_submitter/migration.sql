-- Allow direct super-admin handoff submissions.
-- Super admins have no SalesUser row, so submittedById cannot reference one.
-- submittedByName (a plain String) already carries the submitter's display name for all rows.
-- Existing records retain their submittedById value unchanged.
ALTER TABLE "OnboardingHandoff" ALTER COLUMN "submittedById" DROP NOT NULL;
