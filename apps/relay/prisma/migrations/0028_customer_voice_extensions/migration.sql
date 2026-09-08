-- ─── Location.slug ────────────────────────────────────────────────────────────

ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Generate base slugs from location names
UPDATE "Location"
SET "slug" = SUBSTR(
  LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9 ]', '', 'g'),
      ' +', '-', 'g'
    )
  ), 1, 60
)
WHERE "slug" IS NULL;

-- Fall back to partial ID for empty slugs (all-special-char names)
UPDATE "Location"
SET "slug" = SUBSTR("id", 1, 12)
WHERE "slug" IS NULL OR "slug" = '' OR "slug" = '-';

-- Fix duplicates within same org by appending short ID suffix
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "organizationId", "slug" ORDER BY "createdAt") AS rn
  FROM "Location"
  WHERE "slug" IS NOT NULL
)
UPDATE "Location" l
SET "slug" = l."slug" || '-' || SUBSTR(l.id, 1, 6)
FROM dupes d
WHERE l.id = d.id AND d.rn > 1;

-- Unique per org (partial index, NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS "Location_organizationId_slug_key"
  ON "Location"("organizationId", "slug")
  WHERE "slug" IS NOT NULL;

-- ─── CustomerSurvey ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomerSurvey" (
  "id"                 TEXT         NOT NULL,
  "organizationId"     TEXT         NOT NULL,
  "locationId"         TEXT,
  "title"              TEXT         NOT NULL,
  "description"        TEXT,
  "questions"          JSONB        NOT NULL DEFAULT '[]',
  "isAnonymous"        BOOLEAN      NOT NULL DEFAULT true,
  "status"             TEXT         NOT NULL DEFAULT 'DRAFT',
  "distributionMethod" TEXT         NOT NULL DEFAULT 'LINK',
  "surveyToken"        TEXT         NOT NULL,
  "closedAt"           TIMESTAMP(3),
  "createdById"        TEXT         NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSurvey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSurvey_surveyToken_key"
  ON "CustomerSurvey"("surveyToken");
CREATE INDEX IF NOT EXISTS "CustomerSurvey_organizationId_idx"
  ON "CustomerSurvey"("organizationId");
CREATE INDEX IF NOT EXISTS "CustomerSurvey_surveyToken_idx"
  ON "CustomerSurvey"("surveyToken");

-- ─── CustomerSurveyResponse ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomerSurveyResponse" (
  "id"             TEXT         NOT NULL,
  "surveyId"       TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "locationId"     TEXT,
  "answers"        JSONB        NOT NULL DEFAULT '{}',
  "customerName"   TEXT,
  "customerEmail"  TEXT,
  "submittedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceMetadata" JSONB,
  CONSTRAINT "CustomerSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerSurveyResponse_surveyId_idx"
  ON "CustomerSurveyResponse"("surveyId");
CREATE INDEX IF NOT EXISTS "CustomerSurveyResponse_organizationId_idx"
  ON "CustomerSurveyResponse"("organizationId");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "CustomerSurvey" ADD CONSTRAINT "CustomerSurvey_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSurvey" ADD CONSTRAINT "CustomerSurvey_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSurvey" ADD CONSTRAINT "CustomerSurvey_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSurveyResponse" ADD CONSTRAINT "CustomerSurveyResponse_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "CustomerSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSurveyResponse" ADD CONSTRAINT "CustomerSurveyResponse_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSurveyResponse" ADD CONSTRAINT "CustomerSurveyResponse_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
