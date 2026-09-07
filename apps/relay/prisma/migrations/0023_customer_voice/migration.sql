-- Customer Voice feature: connected Google Business Profile accounts + review ingestion

-- Add customer_voice_enabled flag to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customer_voice_enabled" BOOLEAN NOT NULL DEFAULT false;

-- ConnectedAccount: stores OAuth tokens for third-party service connections
CREATE TABLE IF NOT EXISTS "ConnectedAccount" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider"       TEXT NOT NULL,
  "accountEmail"   TEXT NOT NULL,
  "accountId"      TEXT NOT NULL,
  "accessToken"    TEXT NOT NULL,
  "refreshToken"   TEXT NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "scopes"         TEXT[],
  "connectedById"  TEXT NOT NULL,
  "connectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncAt"     TIMESTAMP(3),
  CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedAccount_organizationId_provider_key"
  ON "ConnectedAccount"("organizationId", "provider");

CREATE INDEX IF NOT EXISTS "ConnectedAccount_organizationId_idx"
  ON "ConnectedAccount"("organizationId");

DO $$ BEGIN
  ALTER TABLE "ConnectedAccount"
    ADD CONSTRAINT "ConnectedAccount_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CustomerReview: reviews ingested from Google Business Profile
CREATE TABLE IF NOT EXISTS "CustomerReview" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "locationId"       TEXT,
  "googleLocationId" TEXT NOT NULL,
  "googleReviewId"   TEXT NOT NULL,
  "reviewerName"     TEXT,
  "rating"           INTEGER NOT NULL,
  "reviewText"       TEXT,
  "reviewReplyText"  TEXT,
  "publishedAt"      TIMESTAMP(3) NOT NULL,
  "sourceUrl"        TEXT,
  "aiClassification" TEXT,
  "aiConfidence"     DOUBLE PRECISION,
  "aiSummary"        TEXT,
  "aiCategory"       TEXT,
  "aiLocationMatch"  TEXT,
  "aiAssetMention"   TEXT,
  "recommendedAction" TEXT,
  "issueId"          TEXT,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerReview_googleReviewId_key"
  ON "CustomerReview"("googleReviewId");

CREATE INDEX IF NOT EXISTS "CustomerReview_organizationId_idx"
  ON "CustomerReview"("organizationId");

CREATE INDEX IF NOT EXISTS "CustomerReview_googleLocationId_idx"
  ON "CustomerReview"("googleLocationId");

CREATE INDEX IF NOT EXISTS "CustomerReview_status_idx"
  ON "CustomerReview"("status");

DO $$ BEGIN
  ALTER TABLE "CustomerReview"
    ADD CONSTRAINT "CustomerReview_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerReview"
    ADD CONSTRAINT "CustomerReview_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerReview"
    ADD CONSTRAINT "CustomerReview_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
