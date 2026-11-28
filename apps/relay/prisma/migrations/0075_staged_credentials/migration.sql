-- CreateTable: StagedCredential
-- Reserves credential slots for invited employees before they accept the invitation.
-- Applied to real EmployeeCredential/EmployeeBadge records on invitation acceptance.
-- Released (SingleCodeLookup entries removed, record deleted) on expiry or cancellation.
CREATE TABLE "StagedCredential" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "invitationId"    TEXT NOT NULL,
    -- "EMPLOYEE_ID" | "ACCESS_CODE" | "BADGE"
    "credentialType"  TEXT NOT NULL,
    -- HMAC-SHA256 of the normalized credential value (same as SingleCodeLookup.credentialIndex)
    "credentialIndex" TEXT NOT NULL,
    -- bcrypt hash of the credential value
    "credentialHash"  TEXT NOT NULL,
    -- e.g. "***1234"
    "maskedDisplay"   TEXT NOT NULL,
    -- optional label for BADGE type
    "label"           TEXT,
    -- raw value for EMPLOYEE_ID type only (stored plaintext on User.employeeId anyway)
    "rawValue"        TEXT,
    -- copied from Invitation.expiresAt for standalone cleanup queries
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StagedCredential_pkey" PRIMARY KEY ("id")
);

-- Index for cleaning up expired staged credentials
CREATE INDEX "StagedCredential_expiresAt_idx" ON "StagedCredential"("expiresAt");
-- Index for looking up staged credentials by invitation
CREATE INDEX "StagedCredential_invitationId_idx" ON "StagedCredential"("invitationId");
-- Index for org-scoped cleanup
CREATE INDEX "StagedCredential_organizationId_idx" ON "StagedCredential"("organizationId");

-- AddForeignKey
ALTER TABLE "StagedCredential" ADD CONSTRAINT "StagedCredential_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StagedCredential" ADD CONSTRAINT "StagedCredential_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
