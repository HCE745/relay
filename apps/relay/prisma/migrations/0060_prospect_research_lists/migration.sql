-- Migration 0060: Prospect Research Library
-- Adds ProspectResearchList and ProspectResearchResult models for persistent
-- storage of AI-discovered companies across sessions (Phase 3).
--
-- Safety notes:
--   • Additive only — no existing tables are altered or dropped.
--   • Both FKs on ProspectResearchList use ON DELETE CASCADE so rows are
--     cleaned up automatically when their owning user is removed.
--   • ProspectResearchResult.prospectId uses ON DELETE SET NULL so promoted
--     CRM prospects are preserved even if the research list is later deleted.
--   • The unique index on (listId, normalizedDomain) uses a partial index
--     WHERE normalizedDomain IS NOT NULL so companies without websites can
--     coexist in the same list without false dedup conflicts.

-- CreateTable
CREATE TABLE "ProspectResearchList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "salesUserId" TEXT,
    "superAdminId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "searchCountry" TEXT,
    "searchState" TEXT,
    "searchIndustry" TEXT,
    "searchEmpMin" INTEGER,
    "searchEmpMax" INTEGER,
    "searchKeywords" TEXT,
    "searchContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectResearchList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectResearchResult" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "normalizedDomain" VARCHAR(253),
    "requestedCountry" TEXT,
    "requestedState" TEXT,
    "verifiedCity" TEXT,
    "verifiedState" TEXT,
    "verifiedCountry" TEXT,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "estimatedEmployees" TEXT,
    "summary" TEXT,
    "fitScore" INTEGER,
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relayFitReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outreachAngle" TEXT,
    "detailsResearchedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'ai_discover',
    "researchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prospectId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectResearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectResearchList_salesUserId_idx" ON "ProspectResearchList"("salesUserId");

-- CreateIndex
CREATE INDEX "ProspectResearchList_superAdminId_idx" ON "ProspectResearchList"("superAdminId");

-- CreateIndex
CREATE INDEX "ProspectResearchList_createdAt_idx" ON "ProspectResearchList"("createdAt");

-- CreateIndex
CREATE INDEX "ProspectResearchResult_listId_idx" ON "ProspectResearchResult"("listId");

-- CreateIndex
CREATE INDEX "ProspectResearchResult_companyName_idx" ON "ProspectResearchResult"("companyName");

-- CreateIndex
CREATE INDEX "ProspectResearchResult_prospectId_idx" ON "ProspectResearchResult"("prospectId");

-- CreateIndex: per-list domain dedup; NULLs excluded so companies without
-- websites can coexist in the same list without triggering a conflict.
CREATE UNIQUE INDEX "ProspectResearchResult_listId_normalizedDomain_key"
    ON "ProspectResearchResult"("listId", "normalizedDomain")
    WHERE "normalizedDomain" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ProspectResearchList"
    ADD CONSTRAINT "ProspectResearchList_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectResearchList"
    ADD CONSTRAINT "ProspectResearchList_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectResearchResult"
    ADD CONSTRAINT "ProspectResearchResult_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ProspectResearchList"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectResearchResult"
    ADD CONSTRAINT "ProspectResearchResult_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
