-- Phase 27: proposals & e-signature. Additive.
CREATE TYPE "cleaning"."ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

CREATE TABLE "cleaning"."Proposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "cleaning"."ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "terms" TEXT,
    "snapshot" JSONB NOT NULL,
    "signerName" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "signedAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Proposal_estimateId_key" ON "cleaning"."Proposal"("estimateId");
CREATE UNIQUE INDEX "Proposal_token_key" ON "cleaning"."Proposal"("token");
CREATE INDEX "Proposal_organizationId_idx" ON "cleaning"."Proposal"("organizationId");
CREATE INDEX "Proposal_convertedCustomerId_idx" ON "cleaning"."Proposal"("convertedCustomerId");
ALTER TABLE "cleaning"."Proposal" ADD CONSTRAINT "Proposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Proposal" ADD CONSTRAINT "Proposal_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "cleaning"."Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
