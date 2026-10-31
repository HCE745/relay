-- Phase 44: multi-step collections. An ordered dunning sequence (email/SMS) that
-- fires by days past due, stops when paid, and can be suppressed per customer
-- (opt-out) or per invoice (hold). Activity is recorded for the timeline.

CREATE TYPE "cleaning"."CollectionChannel" AS ENUM ('EMAIL', 'SMS');

CREATE TABLE "cleaning"."CollectionStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "dayOffset" INTEGER NOT NULL,
    "channel" "cleaning"."CollectionChannel" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionStep_organizationId_idx" ON "cleaning"."CollectionStep"("organizationId");
ALTER TABLE "cleaning"."CollectionStep" ADD CONSTRAINT "CollectionStep_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."CollectionActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "channel" "cleaning"."CollectionChannel" NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionActivity_organizationId_idx" ON "cleaning"."CollectionActivity"("organizationId");
CREATE INDEX "CollectionActivity_invoiceId_idx" ON "cleaning"."CollectionActivity"("invoiceId");
ALTER TABLE "cleaning"."CollectionActivity" ADD CONSTRAINT "CollectionActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CollectionActivity" ADD CONSTRAINT "CollectionActivity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "cleaning"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CollectionActivity" ADD CONSTRAINT "CollectionActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cleaning"."Customer" ADD COLUMN "collectionsOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."Invoice" ADD COLUMN "collectionsHold" BOOLEAN NOT NULL DEFAULT false;
