-- Add pageAccessConfig JSON column to Organization
ALTER TABLE "Organization" ADD COLUMN "pageAccessConfig" JSONB;
