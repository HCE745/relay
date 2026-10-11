-- Phase 22: online payments (Stripe). Additive.

-- AlterTable
ALTER TABLE "cleaning"."Invoice" ADD COLUMN "payLinkToken" TEXT;
CREATE UNIQUE INDEX "Invoice_payLinkToken_key" ON "cleaning"."Invoice"("payLinkToken");

ALTER TABLE "cleaning"."Customer" ADD COLUMN "stripeCustomerId" TEXT;

-- CreateTable: webhook idempotency ledger (platform-level)
CREATE TABLE "cleaning"."ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
