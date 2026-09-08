-- Unified QR action system: presentationMode, enabledActions, surveyId on QrCode;
-- source, qrCodeId on CustomerReview; googleLocationId nullable; qrCodes on Survey.

-- ── QrCode additions ──────────────────────────────────────────────────────────

ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "presentationMode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "enabledActions"   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "surveyId"         TEXT;

DO $$ BEGIN
  ALTER TABLE "QrCode"
    ADD CONSTRAINT "QrCode_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "QrCode_surveyId_idx" ON "QrCode"("surveyId");

-- ── CustomerReview changes ────────────────────────────────────────────────────

-- Make googleLocationId nullable (relaxes NOT NULL — existing rows unaffected)
ALTER TABLE "CustomerReview" ALTER COLUMN "googleLocationId" DROP NOT NULL;

ALTER TABLE "CustomerReview" ADD COLUMN IF NOT EXISTS "source"    TEXT NOT NULL DEFAULT 'GOOGLE';
ALTER TABLE "CustomerReview" ADD COLUMN IF NOT EXISTS "qrCodeId"  TEXT;

DO $$ BEGIN
  ALTER TABLE "CustomerReview"
    ADD CONSTRAINT "CustomerReview_qrCodeId_fkey"
    FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CustomerReview_source_idx"   ON "CustomerReview"("source");
CREATE INDEX IF NOT EXISTS "CustomerReview_qrCodeId_idx" ON "CustomerReview"("qrCodeId");
