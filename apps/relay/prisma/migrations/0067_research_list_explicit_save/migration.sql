-- Migration 0067: add isExplicitlySaved to ProspectResearchList
--
-- Working lists are created automatically when a research job starts; they are
-- NOT shown in Saved Lists until the user explicitly names and confirms them.
-- Default TRUE preserves all existing lists as visible in Saved Lists (backfill).
-- New job-created lists are set to FALSE by the jobs route.

ALTER TABLE "ProspectResearchList"
  ADD COLUMN "isExplicitlySaved" BOOLEAN NOT NULL DEFAULT TRUE;
