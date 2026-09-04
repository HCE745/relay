-- Add isRead flag to CrmEmail for inbox read-state tracking
ALTER TABLE "CrmEmail" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;
