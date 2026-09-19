-- Make CustomerFeedback fields nullable to match current Prisma schema.
-- These fields were inherited as NOT NULL from the original GoogleReview table
-- but are optional in the unified CustomerFeedback model.

ALTER TABLE "CustomerFeedback"
  ALTER COLUMN "externalId" DROP NOT NULL,
  ALTER COLUMN "rating"     DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP NOT NULL;
