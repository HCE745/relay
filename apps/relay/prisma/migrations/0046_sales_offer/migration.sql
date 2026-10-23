-- Add pendingOfferToken to Organization
ALTER TABLE "Organization" ADD COLUMN "pendingOfferToken" TEXT;

-- CreateTable SalesOffer
CREATE TABLE "SalesOffer" (
    "id"                   TEXT NOT NULL,
    "token"                TEXT NOT NULL,
    "createdBySAId"        TEXT,
    "createdBySalesUserId" TEXT,
    "opportunityId"        TEXT,
    "offerType"            TEXT NOT NULL,
    "discountPercent"      DECIMAL(5,2),
    "flatMonthlyPrice"     DECIMAL(10,2),
    "freeMonths"           INTEGER,
    "durationMonths"       INTEGER,
    "targetPlan"           TEXT NOT NULL,
    "maxRedemptions"       INTEGER NOT NULL DEFAULT 1,
    "redemptionCount"      INTEGER NOT NULL DEFAULT 0,
    "expiresAt"            TIMESTAMP(3),
    "redeemedAt"           TIMESTAMP(3),
    "redeemedByOrgId"      TEXT,
    "notes"                TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOffer_token_key" ON "SalesOffer"("token");
CREATE INDEX "SalesOffer_createdBySalesUserId_idx" ON "SalesOffer"("createdBySalesUserId");
CREATE INDEX "SalesOffer_opportunityId_idx" ON "SalesOffer"("opportunityId");
CREATE INDEX "SalesOffer_redeemedByOrgId_idx" ON "SalesOffer"("redeemedByOrgId");

ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_createdBySAId_fkey"
    FOREIGN KEY ("createdBySAId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_createdBySalesUserId_fkey"
    FOREIGN KEY ("createdBySalesUserId") REFERENCES "SalesUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOffer" ADD CONSTRAINT "SalesOffer_redeemedByOrgId_fkey"
    FOREIGN KEY ("redeemedByOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
