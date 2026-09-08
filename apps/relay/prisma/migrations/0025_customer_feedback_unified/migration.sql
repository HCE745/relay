-- Phase 1: CustomerReview → CustomerFeedback unified model
-- Rename table, columns, migrate data into sourceMetadata, add new AI fields,
-- replace global @unique on googleReviewId with partial composite unique index.

-- ── 1. Rename table ────────────────────────────────────────────────────────────
ALTER TABLE "CustomerReview" RENAME TO "CustomerFeedback";

-- ── 2. Rename columns ─────────────────────────────────────────────────────────
ALTER TABLE "CustomerFeedback" RENAME COLUMN "googleReviewId"   TO "externalId";
ALTER TABLE "CustomerFeedback" RENAME COLUMN "reviewerName"     TO "customerName";
ALTER TABLE "CustomerFeedback" RENAME COLUMN "reviewText"       TO "feedbackText";
ALTER TABLE "CustomerFeedback" RENAME COLUMN "publishedAt"      TO "submittedAt";
ALTER TABLE "CustomerFeedback" RENAME COLUMN "recommendedAction" TO "aiRecommendedAction";

-- ── 3. Add new columns ─────────────────────────────────────────────────────────
ALTER TABLE "CustomerFeedback"
  ADD COLUMN IF NOT EXISTS "customerContact"       TEXT,
  ADD COLUMN IF NOT EXISTS "sourceMetadata"        JSONB,
  ADD COLUMN IF NOT EXISTS "aiSentiment"           TEXT,
  ADD COLUMN IF NOT EXISTS "aiUrgency"             TEXT,
  ADD COLUMN IF NOT EXISTS "aiEmployeeMention"     TEXT,
  ADD COLUMN IF NOT EXISTS "aiVendorMention"       TEXT,
  ADD COLUMN IF NOT EXISTS "aiRecurrenceIndicator" BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Migrate source values ───────────────────────────────────────────────────
UPDATE "CustomerFeedback" SET "source" = 'GOOGLE_REVIEW' WHERE "source" = 'GOOGLE';
UPDATE "CustomerFeedback" SET "source" = 'QR_SCAN'       WHERE "source" = 'QR';

-- ── 5. Populate sourceMetadata from deprecated columns ─────────────────────────

-- Google reviews: pack googleLocationId, reviewUrl, replyText, aiLocationMatch into JSON
UPDATE "CustomerFeedback"
SET "sourceMetadata" = jsonb_strip_nulls(jsonb_build_object(
  'googleLocationId', "googleLocationId",
  'reviewUrl',        "sourceUrl",
  'replyText',        "reviewReplyText",
  'aiLocationMatch',  "aiLocationMatch"
))
WHERE "source" = 'GOOGLE_REVIEW';

-- QR records: pack qrCodeId into JSON
UPDATE "CustomerFeedback"
SET "sourceMetadata" = jsonb_strip_nulls(jsonb_build_object(
  'qrCodeId', "qrCodeId"
))
WHERE "source" = 'QR_SCAN';

-- ── 6. Clear synthetic externalIds from QR records ────────────────────────────
-- QR scans have no meaningful external ID; the old googleReviewId value was a
-- synthetic random string used only to satisfy the @unique constraint.
UPDATE "CustomerFeedback"
SET "externalId" = NULL
WHERE "source" = 'QR_SCAN';

-- ── 7. Drop deprecated columns ────────────────────────────────────────────────
-- sourceMetadata is populated above before these are dropped.
ALTER TABLE "CustomerFeedback"
  DROP COLUMN IF EXISTS "googleLocationId",
  DROP COLUMN IF EXISTS "sourceUrl",
  DROP COLUMN IF EXISTS "reviewReplyText",
  DROP COLUMN IF EXISTS "aiLocationMatch";

-- ── 8. Replace old global unique index with partial composite unique index ─────
DROP INDEX IF EXISTS "CustomerReview_googleReviewId_key";

CREATE UNIQUE INDEX "CustomerFeedback_org_source_external_unique"
  ON "CustomerFeedback"("organizationId", "source", "externalId")
  WHERE "externalId" IS NOT NULL;

-- ── 9. Rename existing indexes to match new table name ────────────────────────
ALTER INDEX IF EXISTS "CustomerReview_organizationId_idx"   RENAME TO "CustomerFeedback_organizationId_idx";
ALTER INDEX IF EXISTS "CustomerReview_status_idx"           RENAME TO "CustomerFeedback_status_idx";
ALTER INDEX IF EXISTS "CustomerReview_source_idx"           RENAME TO "CustomerFeedback_source_idx";
ALTER INDEX IF EXISTS "CustomerReview_qrCodeId_idx"         RENAME TO "CustomerFeedback_qrCodeId_idx";

-- googleLocationId index is no longer needed (column dropped)
DROP INDEX IF EXISTS "CustomerReview_googleLocationId_idx";

-- ── 10. Add new recommended indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "CustomerFeedback_organizationId_status_idx"
  ON "CustomerFeedback"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "CustomerFeedback_organizationId_source_idx"
  ON "CustomerFeedback"("organizationId", "source");

CREATE INDEX IF NOT EXISTS "CustomerFeedback_submittedAt_idx"
  ON "CustomerFeedback"("submittedAt");
