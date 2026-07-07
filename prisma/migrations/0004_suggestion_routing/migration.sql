ALTER TABLE "Suggestion" ADD COLUMN "detectedCategory" TEXT;
ALTER TABLE "Suggestion" ADD COLUMN "routedToUserId" TEXT;
ALTER TABLE "Suggestion" ADD COLUMN "routedNote" TEXT;
ALTER TABLE "Suggestion" ADD COLUMN "convertedToIssueId" TEXT;

ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_routedToUserId_fkey"
    FOREIGN KEY ("routedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_convertedToIssueId_fkey"
    FOREIGN KEY ("convertedToIssueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Suggestion_convertedToIssueId_key" ON "Suggestion"("convertedToIssueId");
