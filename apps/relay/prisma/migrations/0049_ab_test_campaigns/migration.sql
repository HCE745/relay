-- AddColumn: abTestGroup and abTestCampaignId to CrmEmail
ALTER TABLE "CrmEmail"
  ADD COLUMN IF NOT EXISTS "abTestGroup"      TEXT,
  ADD COLUMN IF NOT EXISTS "abTestCampaignId" TEXT;

-- CreateTable: AbTestCampaign
CREATE TABLE IF NOT EXISTS "AbTestCampaign" (
  "id"                   TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "description"          TEXT,
  "variants"             JSONB NOT NULL DEFAULT '[]',
  "organizationId"       TEXT,
  "createdBySAId"        TEXT,
  "createdBySalesUserId" TEXT,
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbTestCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AbTestResult
CREATE TABLE IF NOT EXISTS "AbTestResult" (
  "id"              TEXT NOT NULL,
  "campaignId"      TEXT NOT NULL,
  "variant"         TEXT NOT NULL,
  "emailsSent"      INTEGER NOT NULL DEFAULT 0,
  "emailsOpened"    INTEGER NOT NULL DEFAULT 0,
  "linksClicked"    INTEGER NOT NULL DEFAULT 0,
  "repliesReceived" INTEGER NOT NULL DEFAULT 0,
  "openRate"        DECIMAL(5,2) NOT NULL DEFAULT 0,
  "clickRate"       DECIMAL(5,2) NOT NULL DEFAULT 0,
  "replyRate"       DECIMAL(5,2) NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmail_abTestCampaignId_idx" ON "CrmEmail"("abTestCampaignId");
CREATE INDEX IF NOT EXISTS "AbTestCampaign_createdBySAId_idx" ON "AbTestCampaign"("createdBySAId");
CREATE INDEX IF NOT EXISTS "AbTestCampaign_createdBySalesUserId_idx" ON "AbTestCampaign"("createdBySalesUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "AbTestResult_campaignId_variant_key" ON "AbTestResult"("campaignId", "variant");
CREATE INDEX IF NOT EXISTS "AbTestResult_campaignId_idx" ON "AbTestResult"("campaignId");

-- AddForeignKey
ALTER TABLE "CrmEmail"
  ADD CONSTRAINT "CrmEmail_abTestCampaignId_fkey"
  FOREIGN KEY ("abTestCampaignId") REFERENCES "AbTestCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AbTestCampaign"
  ADD CONSTRAINT "AbTestCampaign_createdBySAId_fkey"
  FOREIGN KEY ("createdBySAId") REFERENCES "SuperAdmin"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AbTestCampaign"
  ADD CONSTRAINT "AbTestCampaign_createdBySalesUserId_fkey"
  FOREIGN KEY ("createdBySalesUserId") REFERENCES "SalesUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AbTestResult"
  ADD CONSTRAINT "AbTestResult_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AbTestCampaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
