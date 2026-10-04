-- CreateEnum
CREATE TYPE "cleaning"."AccessItemType" AS ENUM ('KEY', 'FOB', 'CODE', 'BADGE', 'ALARM_CODE');

-- CreateEnum
CREATE TYPE "cleaning"."AccessItemStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'LOST', 'RETURNED');

-- CreateTable
CREATE TABLE "cleaning"."AccessItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "type" "cleaning"."AccessItemType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "description" TEXT,
    "status" "cleaning"."AccessItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "holderUserId" TEXT,
    "secretCiphertext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessItem_organizationId_idx" ON "cleaning"."AccessItem"("organizationId");
CREATE INDEX "AccessItem_serviceLocationId_idx" ON "cleaning"."AccessItem"("serviceLocationId");

-- AddForeignKey
ALTER TABLE "cleaning"."AccessItem" ADD CONSTRAINT "AccessItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."AccessItem" ADD CONSTRAINT "AccessItem_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."AccessItem" ADD CONSTRAINT "AccessItem_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
