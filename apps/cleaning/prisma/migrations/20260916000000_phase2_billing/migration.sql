-- CreateEnum
CREATE TYPE "cleaning"."BillingType" AS ENUM ('FLAT_PER_JOB', 'HOURLY');

-- CreateEnum
CREATE TYPE "cleaning"."PaymentTerms" AS ENUM ('DUE_ON_RECEIPT', 'NET_15', 'NET_30');

-- CreateEnum
CREATE TYPE "cleaning"."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "cleaning"."Customer" ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "paymentTerms" "cleaning"."PaymentTerms" NOT NULL DEFAULT 'DUE_ON_RECEIPT';

-- AlterTable
ALTER TABLE "cleaning"."ServicePlan" ADD COLUMN     "billingType" "cleaning"."BillingType" NOT NULL DEFAULT 'FLAT_PER_JOB',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "rate" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "cleaning"."Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "status" "cleaning"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "jobId" TEXT,
    "activeJobId" TEXT,
    "description" TEXT NOT NULL,
    "siteName" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "cleaning"."Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "cleaning"."Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "cleaning"."Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "cleaning"."Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_activeJobId_key" ON "cleaning"."InvoiceLine"("activeJobId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "cleaning"."InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_jobId_idx" ON "cleaning"."InvoiceLine"("jobId");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "cleaning"."InvoicePayment"("invoiceId");

-- AddForeignKey
ALTER TABLE "cleaning"."Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "cleaning"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "cleaning"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

