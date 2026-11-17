-- White-glove customer onboarding tracking
CREATE TABLE "CustomerOnboarding" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'draft',
  "primaryContactName"  TEXT NOT NULL,
  "primaryContactEmail" TEXT NOT NULL,
  "plan"                TEXT NOT NULL DEFAULT 'essentials',
  "estimatedFacilities" INTEGER NOT NULL DEFAULT 1,
  "internalNotes"       TEXT,
  "ownerId"             TEXT NOT NULL,
  "ownerName"           TEXT NOT NULL,
  "checklist"           JSONB NOT NULL DEFAULT '[]',
  "trialStartDate"      TIMESTAMPTZ,
  "launchedAt"          TIMESTAMPTZ,
  "invitationSentAt"    TIMESTAMPTZ,
  "invitationToken"     TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerOnboarding_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "CustomerOnboarding_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Allow super-admin-created invitations to omit the invitedById FK
ALTER TABLE "Invitation" ALTER COLUMN "invitedById" DROP NOT NULL;
