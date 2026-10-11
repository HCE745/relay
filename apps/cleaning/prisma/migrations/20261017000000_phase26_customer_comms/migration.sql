-- Phase 26: customer communications. Additive.
CREATE TYPE "cleaning"."MessageSender" AS ENUM ('STAFF', 'CUSTOMER');

ALTER TABLE "cleaning"."Customer"
  ADD COLUMN "visitRemindersOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "serviceSummariesOptIn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "cleaning"."Organization"
  ADD COLUMN "visitReminderLeadHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "paymentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "cleaning"."CustomerMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sender" "cleaning"."MessageSender" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "readByStaffAt" TIMESTAMP(3),
    "readByCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerMessage_organizationId_idx" ON "cleaning"."CustomerMessage"("organizationId");
CREATE INDEX "CustomerMessage_customerId_createdAt_idx" ON "cleaning"."CustomerMessage"("customerId", "createdAt");
ALTER TABLE "cleaning"."CustomerMessage" ADD CONSTRAINT "CustomerMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustomerMessage" ADD CONSTRAINT "CustomerMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
