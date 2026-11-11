-- Add demo link attribution fields to LinkClick
ALTER TABLE "LinkClick" ADD COLUMN "contactId" TEXT;
ALTER TABLE "LinkClick" ADD COLUMN "salesUserId" TEXT;

-- Foreign key constraints
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_salesUserId_fkey"
  FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for efficient lookups
CREATE INDEX "LinkClick_contactId_idx" ON "LinkClick"("contactId");
CREATE INDEX "LinkClick_salesUserId_idx" ON "LinkClick"("salesUserId");
