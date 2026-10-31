-- Phase 40: sales tax. A jurisdiction rate catalog, per-site/per-plan taxability
-- config (NOT taxable by default), and tax snapshots on each invoice line so a
-- rate change never rewrites a historical invoice.

CREATE TABLE "cleaning"."TaxRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "rate" DECIMAL(6,4) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaxRate_organizationId_idx" ON "cleaning"."TaxRate"("organizationId");
ALTER TABLE "cleaning"."TaxRate" ADD CONSTRAINT "TaxRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-site taxability (default NOT taxable).
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN "taxRateId" TEXT;
ALTER TABLE "cleaning"."ServiceLocation" ADD CONSTRAINT "ServiceLocation_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "cleaning"."TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-service-type override (NULL = inherit the site default).
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN "taxable" BOOLEAN;
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN "taxRateId" TEXT;
ALTER TABLE "cleaning"."ServicePlan" ADD CONSTRAINT "ServicePlan_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "cleaning"."TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Line-level tax snapshot.
ALTER TABLE "cleaning"."InvoiceLine" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."InvoiceLine" ADD COLUMN "taxRatePct" DECIMAL(6,4);
ALTER TABLE "cleaning"."InvoiceLine" ADD COLUMN "taxRateName" TEXT;
ALTER TABLE "cleaning"."InvoiceLine" ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
