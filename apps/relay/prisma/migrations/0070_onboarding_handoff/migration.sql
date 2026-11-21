-- Sales-to-Onboarding Handoff table.
-- Bridges a CRM opportunity to the white-glove CustomerOnboarding workflow.
-- The row exists before the Organization is created; acceptance atomically creates both.

-- Add onboardingSpecialist flag to SalesUser
ALTER TABLE "SalesUser" ADD COLUMN "onboardingSpecialist" BOOLEAN NOT NULL DEFAULT false;

-- Create OnboardingHandoff table
CREATE TABLE "OnboardingHandoff" (
    "id"                        TEXT NOT NULL,
    "prospectId"                TEXT NOT NULL,
    "opportunityId"             TEXT,
    "submittedById"             TEXT NOT NULL,
    "submittedByName"           TEXT NOT NULL,
    "onboardingType"            TEXT NOT NULL DEFAULT 'white_glove',
    "isTest"                    BOOLEAN NOT NULL DEFAULT false,
    "companyName"               TEXT NOT NULL,
    "primaryContactName"        TEXT NOT NULL,
    "primaryContactEmail"       TEXT NOT NULL,
    "primaryContactPhone"       TEXT,
    "plan"                      TEXT NOT NULL DEFAULT 'essentials',
    "estimatedFacilities"       INTEGER NOT NULL DEFAULT 1,
    "trialStartDate"            TIMESTAMP(3),
    "salesNotes"                TEXT,
    "customerAgreementConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status"                    TEXT NOT NULL DEFAULT 'pending_review',
    "reviewedById"              TEXT,
    "reviewedByName"            TEXT,
    "reviewedAt"                TIMESTAMP(3),
    "rejectionReason"           TEXT,
    "customerOnboardingId"      TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingHandoff_pkey" PRIMARY KEY ("id")
);

-- Unique: one active handoff per opportunity (POST handler nulls old rejected/cancelled rows before re-submit)
CREATE UNIQUE INDEX "OnboardingHandoff_opportunityId_key"
    ON "OnboardingHandoff"("opportunityId");

-- Unique: one CustomerOnboarding per handoff
CREATE UNIQUE INDEX "OnboardingHandoff_customerOnboardingId_key"
    ON "OnboardingHandoff"("customerOnboardingId");

-- Partial unique index: at most one pending_review handoff per prospect (concurrent-safe)
CREATE UNIQUE INDEX "OnboardingHandoff_prospectId_active_key"
    ON "OnboardingHandoff"("prospectId")
    WHERE (status = 'pending_review');

-- Standard indexes
CREATE INDEX "OnboardingHandoff_prospectId_idx"    ON "OnboardingHandoff"("prospectId");
CREATE INDEX "OnboardingHandoff_submittedById_idx" ON "OnboardingHandoff"("submittedById");
CREATE INDEX "OnboardingHandoff_status_idx"        ON "OnboardingHandoff"("status");
CREATE INDEX "OnboardingHandoff_createdAt_idx"     ON "OnboardingHandoff"("createdAt");

-- Foreign keys
ALTER TABLE "OnboardingHandoff"
    ADD CONSTRAINT "OnboardingHandoff_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OnboardingHandoff"
    ADD CONSTRAINT "OnboardingHandoff_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingHandoff"
    ADD CONSTRAINT "OnboardingHandoff_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "SalesUser"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
