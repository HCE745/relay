-- Add web search citation and employee count source fields to ProspectResearchResult
ALTER TABLE "ProspectResearchResult" ADD COLUMN "sourceCitations" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ProspectResearchResult" ADD COLUMN "employeeCountSource" TEXT;
