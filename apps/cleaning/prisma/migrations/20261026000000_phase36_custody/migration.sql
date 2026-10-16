-- Phase 36: key & asset custody tracking. Additive.
CREATE TYPE "cleaning"."CustodyAction" AS ENUM ('CHECKED_OUT', 'CHECKED_IN', 'TRANSFERRED', 'REPORTED_LOST', 'REPLACED');

-- AccessItem: current-hold timestamp + replacement chain.
ALTER TABLE "cleaning"."AccessItem"
  ADD COLUMN "heldSince" TIMESTAMP(3),
  ADD COLUMN "replacesId" TEXT;
CREATE UNIQUE INDEX "AccessItem_replacesId_key" ON "cleaning"."AccessItem"("replacesId");
ALTER TABLE "cleaning"."AccessItem" ADD CONSTRAINT "AccessItem_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "cleaning"."AccessItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Asset: current custody holder (distinct from long-term assignment).
ALTER TABLE "cleaning"."Asset"
  ADD COLUMN "custodyUserId" TEXT,
  ADD COLUMN "custodySince" TIMESTAMP(3);
ALTER TABLE "cleaning"."Asset" ADD CONSTRAINT "Asset_custodyUserId_fkey" FOREIGN KEY ("custodyUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cleaning"."CustodyEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessItemId" TEXT,
    "assetId" TEXT,
    "action" "cleaning"."CustodyAction" NOT NULL,
    "holderUserId" TEXT,
    "fromUserId" TEXT,
    "jobId" TEXT,
    "serviceLocationId" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustodyEvent_organizationId_idx" ON "cleaning"."CustodyEvent"("organizationId");
CREATE INDEX "CustodyEvent_accessItemId_idx" ON "cleaning"."CustodyEvent"("accessItemId");
CREATE INDEX "CustodyEvent_assetId_idx" ON "cleaning"."CustodyEvent"("assetId");

ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_accessItemId_fkey" FOREIGN KEY ("accessItemId") REFERENCES "cleaning"."AccessItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "cleaning"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."CustodyEvent" ADD CONSTRAINT "CustodyEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
