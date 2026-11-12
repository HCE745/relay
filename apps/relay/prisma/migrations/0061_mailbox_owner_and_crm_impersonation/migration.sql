-- Migration 0061: mailboxOwnerSalesUserId + CrmRepImpersonationLog
--
-- Purpose:
--   1. Add CrmEmail.mailboxOwnerSalesUserId — tracks which sales rep's mailbox
--      an email belongs to, regardless of direction (sent vs received).
--      Previously, sentBySalesUserId was incorrectly used for received emails
--      from IMAP sync. This new field handles inbox ownership cleanly:
--        sent emails:     sentBySalesUserId = rep, mailboxOwnerSalesUserId = rep
--        received emails: sentBySalesUserId = null, mailboxOwnerSalesUserId = rep
--
--   2. Add CrmRepImpersonationLog — audit trail for super admin "View CRM as Rep"
--      sessions. Each row records who impersonated whom and for how long.
--
-- NOT applied to production. Run after migration 0060 is applied.
-- DO NOT apply without explicit authorization.

-- ── 1. mailboxOwnerSalesUserId ─────────────────────────────────────────────────

ALTER TABLE "CrmEmail"
  ADD COLUMN "mailboxOwnerSalesUserId" TEXT;

CREATE INDEX "CrmEmail_mailboxOwnerSalesUserId_idx"
  ON "CrmEmail"("mailboxOwnerSalesUserId");

ALTER TABLE "CrmEmail"
  ADD CONSTRAINT "CrmEmail_mailboxOwnerSalesUserId_fkey"
  FOREIGN KEY ("mailboxOwnerSalesUserId")
  REFERENCES "SalesUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: for compose-sent emails, mailbox owner = sender
UPDATE "CrmEmail"
SET "mailboxOwnerSalesUserId" = "sentBySalesUserId"
WHERE "sentBySalesUserId" IS NOT NULL
  AND "mailboxOwnerSalesUserId" IS NULL
  AND direction = 'sent';

-- Backfill: for IMAP-synced emails (both directions), mailbox owner = config's sales user
UPDATE "CrmEmail" e
SET "mailboxOwnerSalesUserId" = ic."salesUserId"
FROM "ImapConfig" ic
WHERE e."imapConfigId" = ic.id
  AND ic."salesUserId" IS NOT NULL
  AND e."mailboxOwnerSalesUserId" IS NULL;

-- ── 2. CrmRepImpersonationLog ──────────────────────────────────────────────────

CREATE TABLE "CrmRepImpersonationLog" (
    "id"             TEXT         NOT NULL,
    "superAdminId"   TEXT         NOT NULL,
    "superAdminName" TEXT         NOT NULL,
    "salesUserId"    TEXT         NOT NULL,
    "salesUserName"  TEXT         NOT NULL,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"        TIMESTAMP(3),

    CONSTRAINT "CrmRepImpersonationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmRepImpersonationLog_superAdminId_idx"
  ON "CrmRepImpersonationLog"("superAdminId");

CREATE INDEX "CrmRepImpersonationLog_salesUserId_idx"
  ON "CrmRepImpersonationLog"("salesUserId");

ALTER TABLE "CrmRepImpersonationLog"
  ADD CONSTRAINT "CrmRepImpersonationLog_superAdminId_fkey"
  FOREIGN KEY ("superAdminId")
  REFERENCES "SuperAdmin"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmRepImpersonationLog"
  ADD CONSTRAINT "CrmRepImpersonationLog_salesUserId_fkey"
  FOREIGN KEY ("salesUserId")
  REFERENCES "SalesUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
