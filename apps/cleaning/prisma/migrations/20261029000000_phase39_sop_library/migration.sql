-- Phase 39: SOP library (procedures, versioning, acknowledgment, section FTS).
CREATE TYPE "cleaning"."SopCategory" AS ENUM ('SAFETY', 'CHEMICAL', 'EQUIPMENT', 'SERVICE_PROCEDURE', 'SITE_SPECIFIC', 'HR', 'EMERGENCY');
CREATE TYPE "cleaning"."SopStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "cleaning"."Sop" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "cleaning"."SopCategory" NOT NULL,
    "status" "cleaning"."SopStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3),
    "keywords" TEXT,
    "attachmentUrl" TEXT,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "reackIntervalDays" INTEGER,
    "appliesEveryone" BOOLEAN NOT NULL DEFAULT true,
    "appliesRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "appliesSiteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "appliesServicePlanIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sop_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Sop_organizationId_status_idx" ON "cleaning"."Sop"("organizationId", "status");
ALTER TABLE "cleaning"."Sop" ADD CONSTRAINT "Sop_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."SopVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sopId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" "cleaning"."SopCategory" NOT NULL,
    "keywords" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SopVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SopVersion_sopId_version_key" ON "cleaning"."SopVersion"("sopId", "version");
CREATE INDEX "SopVersion_organizationId_idx" ON "cleaning"."SopVersion"("organizationId");
ALTER TABLE "cleaning"."SopVersion" ADD CONSTRAINT "SopVersion_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "cleaning"."Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."SopSection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sopTitle" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SopSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SopSection_sopVersionId_idx" ON "cleaning"."SopSection"("sopVersionId");
CREATE INDEX "SopSection_organizationId_idx" ON "cleaning"."SopSection"("organizationId");
ALTER TABLE "cleaning"."SopSection" ADD CONSTRAINT "SopSection_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "cleaning"."SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search vector (heading/title/keywords weight A, body weight B).
-- Generated + STORED, maintained by Postgres; queried via $queryRaw. Not in the
-- Prisma schema (opaque to the client). to_tsvector('english', …) is IMMUTABLE,
-- so it is valid in a generated column.
ALTER TABLE "cleaning"."SopSection" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("heading", '') || ' ' || coalesce("sopTitle", '') || ' ' || coalesce("keywords", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'B')
  ) STORED;
CREATE INDEX "SopSection_search_idx" ON "cleaning"."SopSection" USING GIN ("searchVector");

CREATE TABLE "cleaning"."SopAcknowledgment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SopAcknowledgment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SopAcknowledgment_sopId_userId_version_key" ON "cleaning"."SopAcknowledgment"("sopId", "userId", "version");
CREATE INDEX "SopAcknowledgment_organizationId_userId_idx" ON "cleaning"."SopAcknowledgment"("organizationId", "userId");
ALTER TABLE "cleaning"."SopAcknowledgment" ADD CONSTRAINT "SopAcknowledgment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SopAcknowledgment" ADD CONSTRAINT "SopAcknowledgment_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "cleaning"."Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SopAcknowledgment" ADD CONSTRAINT "SopAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."SopIssueMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issueCategory" "cleaning"."IssueCategory" NOT NULL,
    "sopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SopIssueMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SopIssueMapping_organizationId_issueCategory_sopId_key" ON "cleaning"."SopIssueMapping"("organizationId", "issueCategory", "sopId");
CREATE INDEX "SopIssueMapping_organizationId_idx" ON "cleaning"."SopIssueMapping"("organizationId");
ALTER TABLE "cleaning"."SopIssueMapping" ADD CONSTRAINT "SopIssueMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SopIssueMapping" ADD CONSTRAINT "SopIssueMapping_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "cleaning"."Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
