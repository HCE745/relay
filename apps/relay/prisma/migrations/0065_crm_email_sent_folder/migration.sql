-- Migration 0065: Track whether the outgoing email was appended to the sender's IMAP Sent folder
ALTER TABLE "CrmEmail" ADD COLUMN "sentFolderAttempted" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CrmEmail" ADD COLUMN "sentFolderSaved" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CrmEmail" ADD COLUMN "sentFolderError" TEXT;
