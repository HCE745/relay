-- Migration 0058: CRM signup tracking, inbound round-robin, onboarding status

-- ── Organization: link to CRM prospect ───────────────────────────────────────
ALTER TABLE "Organization" ADD COLUMN "crmProspectId" TEXT;
CREATE UNIQUE INDEX "Organization_crmProspectId_key" ON "Organization"("crmProspectId");

-- ── Prospect: registration and onboarding tracking ────────────────────────────
ALTER TABLE "Prospect" ADD COLUMN "relayOrganizationId" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "registeredAt"             TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "onboardingStatus"         TEXT;
ALTER TABLE "Prospect" ADD COLUMN "onboardingLastActivityAt" TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "isTestRecord"             BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Prospect_relayOrganizationId_key"      ON "Prospect"("relayOrganizationId");
CREATE        INDEX "Prospect_relayOrganizationId_idx"      ON "Prospect"("relayOrganizationId");
CREATE        INDEX "Prospect_onboardingStatus_idx"         ON "Prospect"("onboardingStatus");
CREATE        INDEX "Prospect_registeredAt_idx"             ON "Prospect"("registeredAt");
CREATE        INDEX "Prospect_isTestRecord_idx"             ON "Prospect"("isTestRecord");

-- ── SalesUser: inbound round-robin eligibility ───────────────────────────────
ALTER TABLE "SalesUser" ADD COLUMN "inboundEligible"      BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "SalesUser" ADD COLUMN "inboundLastAssignedAt" TIMESTAMP(3);

CREATE INDEX "SalesUser_inboundEligible_idx"      ON "SalesUser"("inboundEligible");
CREATE INDEX "SalesUser_inboundLastAssignedAt_idx" ON "SalesUser"("inboundLastAssignedAt");
