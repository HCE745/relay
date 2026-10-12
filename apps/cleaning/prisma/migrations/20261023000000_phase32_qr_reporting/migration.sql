-- Phase 32: QR operational reporting. Additive.
-- NB: the IssueSource 'QR' value is added in its own migration
-- (20261022500000_phase32_qr_source) so the ADD VALUE commits before it's used.

-- External (QR/occupant) reports have no internal reporter.
ALTER TABLE "cleaning"."Issue" ALTER COLUMN "reportedById" DROP NOT NULL;
ALTER TABLE "cleaning"."Issue"
  ADD COLUMN "qrCodeId" TEXT,
  ADD COLUMN "reporterIpHash" TEXT;

CREATE TABLE "cleaning"."QrCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrCode_token_key" ON "cleaning"."QrCode"("token");
CREATE INDEX "QrCode_organizationId_idx" ON "cleaning"."QrCode"("organizationId");
CREATE INDEX "QrCode_serviceLocationId_idx" ON "cleaning"."QrCode"("serviceLocationId");
CREATE INDEX "Issue_qrCodeId_idx" ON "cleaning"."Issue"("qrCodeId");

ALTER TABLE "cleaning"."QrCode" ADD CONSTRAINT "QrCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."QrCode" ADD CONSTRAINT "QrCode_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "cleaning"."QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
