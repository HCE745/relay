-- Migration 0074: Employee auth corrections (Phase 1)
-- Adds SingleCodeLookup for cross-method credential collision prevention
-- Adds AuthAuditLog for authentication event auditing

-- ── SingleCodeLookup ──────────────────────────────────────────────────────────
-- Unified index enforcing that an HMAC credential value is unique across ALL
-- single-code auth methods (Employee ID and access codes) within an org.
-- Prevents the case where Employee A's employeeId HMAC collides with
-- Employee B's accessCode HMAC, which would match both during lookup.
CREATE TABLE "SingleCodeLookup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialIndex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SingleCodeLookup_pkey" PRIMARY KEY ("id")
);

-- Composite unique constraint — the core invariant
CREATE UNIQUE INDEX "SingleCodeLookup_organizationId_credentialIndex_key"
  ON "SingleCodeLookup"("organizationId", "credentialIndex");

CREATE INDEX "SingleCodeLookup_organizationId_idx"
  ON "SingleCodeLookup"("organizationId");

ALTER TABLE "SingleCodeLookup"
  ADD CONSTRAINT "SingleCodeLookup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AuthAuditLog ──────────────────────────────────────────────────────────────
-- Append-only log of authentication events. Never stores raw credentials.
CREATE TABLE "AuthAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "deviceId" TEXT,
    -- "EMPLOYEE_ID" | "ACCESS_CODE" | "BADGE" | "EMAIL_PASSWORD"
    "authMethod" TEXT,
    -- "SUCCESS" | "FAILURE"
    "outcome" TEXT NOT NULL,
    -- "INVALID_CREDENTIAL" | "USER_INACTIVE" | "DEVICE_REVOKED" | "METHOD_NOT_PERMITTED"
    -- | "RATE_LIMITED" | "DEVICE_REGISTERED" | "DEVICE_REVOKED_ADMIN" | "SESSION_INVALIDATED"
    "failureReason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditLog_organizationId_createdAt_idx"
  ON "AuthAuditLog"("organizationId", "createdAt");

CREATE INDEX "AuthAuditLog_userId_createdAt_idx"
  ON "AuthAuditLog"("userId", "createdAt");

CREATE INDEX "AuthAuditLog_deviceId_createdAt_idx"
  ON "AuthAuditLog"("deviceId", "createdAt");
