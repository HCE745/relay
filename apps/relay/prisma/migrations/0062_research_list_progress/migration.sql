-- Migration 0062: Research List Progress Tracking
-- Adds per-company completion state and per-list status to the
-- ProspectResearchResult and ProspectResearchList models.
--
-- Safety notes:
--   • All new columns have DEFAULT values, so existing rows stay valid with
--     no backfill required.
--   • isDone defaults to false (not done).
--   • status defaults to 'active'.
--   • manuallyCompleted defaults to false (auto-managed by default).
--   • No existing columns are altered or removed.
--   • No existing indexes are changed.

-- ProspectResearchResult: per-company completion state
ALTER TABLE "ProspectResearchResult"
  ADD COLUMN "isDone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "doneAt" TIMESTAMP(3);

-- ProspectResearchList: list-level status
ALTER TABLE "ProspectResearchList"
  ADD COLUMN "status"            TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN "completedAt"       TIMESTAMP(3),
  ADD COLUMN "manuallyCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Indexes for efficient filtering
CREATE INDEX "ProspectResearchResult_isDone_idx" ON "ProspectResearchResult"("isDone");
CREATE INDEX "ProspectResearchList_status_idx"   ON "ProspectResearchList"("status");
