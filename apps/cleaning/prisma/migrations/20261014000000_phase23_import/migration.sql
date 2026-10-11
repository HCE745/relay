-- Phase 23: customer CSV import. Additive.

ALTER TABLE "cleaning"."Customer" ADD COLUMN "importBatchId" TEXT;
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN "importBatchId" TEXT;
ALTER TABLE "cleaning"."Contact" ADD COLUMN "importBatchId" TEXT;

CREATE TABLE "cleaning"."ImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "filename" TEXT,
    "customersCreated" INTEGER NOT NULL DEFAULT 0,
    "sitesCreated" INTEGER NOT NULL DEFAULT 0,
    "contactsCreated" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportBatch_organizationId_idx" ON "cleaning"."ImportBatch"("organizationId");
CREATE INDEX "Customer_importBatchId_idx" ON "cleaning"."Customer"("importBatchId");
CREATE INDEX "ServiceLocation_importBatchId_idx" ON "cleaning"."ServiceLocation"("importBatchId");
CREATE INDEX "Contact_importBatchId_idx" ON "cleaning"."Contact"("importBatchId");

ALTER TABLE "cleaning"."ImportBatch" ADD CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
