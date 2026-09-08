-- Create Survey, SurveyQuestion, SurveyResponse, SurveyAnswer tables.
-- These were added to schema.prisma but never had a corresponding migration.
-- All statements use IF NOT EXISTS so re-running is safe if tables already exist.

CREATE TABLE IF NOT EXISTS "Survey" (
    "id"             TEXT          NOT NULL,
    "organizationId" TEXT          NOT NULL,
    "title"          TEXT          NOT NULL,
    "description"    TEXT,
    "status"         TEXT          NOT NULL DEFAULT 'DRAFT',
    "isAnonymous"    BOOLEAN       NOT NULL DEFAULT true,
    "startsAt"       TIMESTAMP(3),
    "endsAt"         TIMESTAMP(3),
    "closedAt"       TIMESTAMP(3),
    "createdById"    TEXT          NOT NULL,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyQuestion" (
    "id"       TEXT     NOT NULL,
    "surveyId" TEXT     NOT NULL,
    "order"    INTEGER  NOT NULL,
    "type"     TEXT     NOT NULL,
    "text"     TEXT     NOT NULL,
    "required" BOOLEAN  NOT NULL DEFAULT true,
    "options"  JSONB,
    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyResponse" (
    "id"           TEXT         NOT NULL,
    "surveyId"     TEXT         NOT NULL,
    "respondentId" TEXT,
    "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyAnswer" (
    "id"          TEXT     NOT NULL,
    "responseId"  TEXT     NOT NULL,
    "questionId"  TEXT     NOT NULL,
    "ratingValue" INTEGER,
    "boolValue"   BOOLEAN,
    "choiceValue" TEXT,
    "textValue"   TEXT,
    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotent via exception handling)
DO $$ BEGIN
  ALTER TABLE "Survey" ADD CONSTRAINT "Survey_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentId_fkey"
    FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey"
    FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Re-assert the QrCode → Survey FK that 0024 attempted
-- (may already exist if Survey table existed when 0024 ran)
DO $$ BEGIN
  ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SurveyResponse_surveyId_respondentId_key"
    ON "SurveyResponse"("surveyId", "respondentId");

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyAnswer_responseId_questionId_key"
    ON "SurveyAnswer"("responseId", "questionId");

CREATE INDEX IF NOT EXISTS "Survey_organizationId_idx" ON "Survey"("organizationId");
CREATE INDEX IF NOT EXISTS "Survey_status_idx"         ON "Survey"("status");
CREATE INDEX IF NOT EXISTS "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");
CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");
CREATE INDEX IF NOT EXISTS "SurveyAnswer_questionId_idx"  ON "SurveyAnswer"("questionId");
