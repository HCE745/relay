-- Add isDemo flag to SalesUser for demo account identification
ALTER TABLE "SalesUser" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
