-- Phase 1: Employee authentication, registered devices, and organization auth policy.
--
-- New models: EmployeeCredential, EmployeeBadge, RegisteredDevice
-- New fields on User: employeeId, employeeSessionVersion
-- New fields on Organization: authPolicyConfig
--
-- All credential lookup indices use server-keyed HMAC-SHA256 (CREDENTIAL_HMAC_SECRET).
-- No plaintext credentials are stored.

-- ── Organization: auth policy config ─────────────────────────────────────────
ALTER TABLE "Organization" ADD COLUMN "authPolicyConfig" JSONB;

-- ── User: employee identity + session revocation ──────────────────────────────
ALTER TABLE "User" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "User" ADD COLUMN "employeeSessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Partial unique index: enforce org-scoped uniqueness only for non-null employeeIds.
CREATE UNIQUE INDEX "User_organizationId_employeeId_key"
  ON "User" ("organizationId", "employeeId")
  WHERE "employeeId" IS NOT NULL;

-- ── EmployeeCredential ────────────────────────────────────────────────────────
-- One record per employee. Tracks which credential methods are enabled
-- and stores HMAC lookup indices (never plaintext) for fast org-scoped lookup.
CREATE TABLE "EmployeeCredential" (
  "id"                 TEXT         NOT NULL PRIMARY KEY,
  "userId"             TEXT         NOT NULL,
  "organizationId"     TEXT         NOT NULL,

  "employeeIdEnabled"  BOOLEAN      NOT NULL DEFAULT false,
  -- HMAC(CREDENTIAL_HMAC_SECRET, normalize(user.employeeId)) — recomputed when employeeId changes
  "employeeIdIndex"    TEXT,

  "accessCodeEnabled"  BOOLEAN      NOT NULL DEFAULT false,
  -- HMAC(CREDENTIAL_HMAC_SECRET, normalize(code))
  "accessCodeIndex"    TEXT,
  -- bcrypt hash of the raw access code
  "accessCodeHash"     TEXT,
  -- last few characters for display only, e.g. "***4X2"
  "accessCodeMasked"   TEXT,

  "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "EmployeeCredential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "EmployeeCredential_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "EmployeeCredential_userId_key"
  ON "EmployeeCredential" ("userId");

-- Org-scoped unique lookup index (NULL values are excluded from uniqueness)
CREATE UNIQUE INDEX "EmployeeCredential_orgId_employeeIdIndex_key"
  ON "EmployeeCredential" ("organizationId", "employeeIdIndex")
  WHERE "employeeIdIndex" IS NOT NULL;

CREATE UNIQUE INDEX "EmployeeCredential_orgId_accessCodeIndex_key"
  ON "EmployeeCredential" ("organizationId", "accessCodeIndex")
  WHERE "accessCodeIndex" IS NOT NULL;

CREATE INDEX "EmployeeCredential_organizationId_idx"
  ON "EmployeeCredential" ("organizationId");

-- ── EmployeeBadge ─────────────────────────────────────────────────────────────
-- Multiple badges per employee. Covers Relay-generated QR, Relay-generated
-- barcode, and third-party (imported) badge values.
CREATE TABLE "EmployeeBadge" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "userId"           TEXT        NOT NULL,
  "organizationId"   TEXT        NOT NULL,

  -- "RELAY_QR" | "RELAY_BARCODE" | "THIRD_PARTY"
  "badgeType"        TEXT        NOT NULL,
  -- HMAC(CREDENTIAL_HMAC_SECRET, normalize(value)) — fast org-scoped lookup
  "credentialIndex"  TEXT        NOT NULL,
  -- bcrypt hash for Relay-generated credentials; NULL for third-party
  "credentialHash"   TEXT,
  -- Masked display value, e.g. "***abc123"
  "maskedDisplay"    TEXT        NOT NULL,

  "isActive"         BOOLEAN     NOT NULL DEFAULT true,
  "revokedAt"        TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "EmployeeBadge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "EmployeeBadge_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Org-scoped unique: one badge value per org (prevents cross-employee credential sharing)
CREATE UNIQUE INDEX "EmployeeBadge_organizationId_credentialIndex_key"
  ON "EmployeeBadge" ("organizationId", "credentialIndex");

CREATE INDEX "EmployeeBadge_userId_isActive_idx"
  ON "EmployeeBadge" ("userId", "isActive");

CREATE INDEX "EmployeeBadge_organizationId_isActive_idx"
  ON "EmployeeBadge" ("organizationId", "isActive");

-- ── RegisteredDevice ─────────────────────────────────────────────────────────
-- Devices registered by an administrator to display a persistent login page.
-- Session policy on device overrides org-level defaults when non-null.
CREATE TABLE "RegisteredDevice" (
  "id"                        TEXT        NOT NULL PRIMARY KEY,
  "organizationId"            TEXT        NOT NULL,
  "registeredByUserId"        TEXT,

  "deviceName"                TEXT        NOT NULL,
  "locationId"                TEXT,
  "departmentId"              TEXT,
  -- Free-text workstation/station identifier
  "stationId"                 TEXT,

  -- "STANDARD" | "QUICK_ACCESS"
  "loginMode"                 TEXT        NOT NULL DEFAULT 'STANDARD',

  -- JSON array of permitted method names: ["EMPLOYEE_ID","ACCESS_CODE","BADGE"]
  "permittedMethods"          JSONB       NOT NULL DEFAULT '[]',

  -- Session policy (NULL = inherit org default for each setting)
  "inactivityTimeoutSeconds"  INTEGER,
  "maxSessionDurationSeconds" INTEGER,
  "disableInactivityTimeout"  BOOLEAN     NOT NULL DEFAULT false,
  "disableMaxSessionDuration" BOOLEAN     NOT NULL DEFAULT false,

  -- Device token (HttpOnly cookie) stored as HMAC index + bcrypt hash; never plaintext
  "deviceTokenIndex"          TEXT        NOT NULL,
  "deviceTokenHash"           TEXT        NOT NULL,

  "platform"                  TEXT,
  "deviceInfo"                JSONB,

  "isActive"                  BOOLEAN     NOT NULL DEFAULT true,
  -- Increment to invalidate all current sessions on this device
  "sessionVersion"            INTEGER     NOT NULL DEFAULT 0,

  "registeredAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastSeenAt"                TIMESTAMPTZ,
  "revokedAt"                 TIMESTAMPTZ,

  CONSTRAINT "RegisteredDevice_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "RegisteredDevice_registeredByUserId_fkey"
    FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "RegisteredDevice_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL,
  CONSTRAINT "RegisteredDevice_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "RegisteredDevice_deviceTokenIndex_key"
  ON "RegisteredDevice" ("deviceTokenIndex");

CREATE INDEX "RegisteredDevice_organizationId_isActive_idx"
  ON "RegisteredDevice" ("organizationId", "isActive");
