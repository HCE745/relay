-- CreateEnum
CREATE TYPE "cleaning"."ExportType" AS ENUM ('QBO_INVOICES', 'QBO_CUSTOMERS', 'XERO_INVOICES', 'XERO_CONTACTS', 'GUSTO_HOURS', 'ADP_HOURS');

-- CreateTable
CREATE TABLE "cleaning"."ExportRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "cleaning"."ExportType" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportRun_organizationId_idx" ON "cleaning"."ExportRun"("organizationId");

-- AddForeignKey
ALTER TABLE "cleaning"."ExportRun" ADD CONSTRAINT "ExportRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
