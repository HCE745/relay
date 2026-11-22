-- Phase B: white-glove wizard progress state.
-- wizardProgress stores { currentStepKey, completedSteps, skippedSteps, lastSavedAt }.
-- Nullable — null means the wizard has never been opened for this record.
ALTER TABLE "CustomerOnboarding" ADD COLUMN "wizardProgress" JSONB;
