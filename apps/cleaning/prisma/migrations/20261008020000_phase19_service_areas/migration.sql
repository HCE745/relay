-- CreateEnum
CREATE TYPE "cleaning"."ExclusionReason" AS ENUM ('OUT_OF_RANGE', 'NO_CREW_COVERAGE', 'ASSIGNED_TO_OTHER_OFFICE', 'ACCESS_ISSUE', 'SAFETY_INCIDENT', 'NON_PAYMENT', 'OTHER');

-- AlterTable
ALTER TABLE "cleaning"."QuoteRequest" ADD COLUMN     "excluded" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "exclusionReason" TEXT,
    ADD COLUMN     "exclusionNote" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."ServiceArea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zipCodes" TEXT[],
    "centerLat" DECIMAL(9,6),
    "centerLng" DECIMAL(9,6),
    "radiusMiles" DECIMAL(6,2),
    "officeLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ExcludedAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "reason" "cleaning"."ExclusionReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExcludedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ExcludedContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "reason" "cleaning"."ExclusionReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExcludedContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."ExcludedZone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" "cleaning"."ExclusionReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExcludedZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceArea_organizationId_idx" ON "cleaning"."ServiceArea"("organizationId");
CREATE INDEX "ExcludedAddress_organizationId_idx" ON "cleaning"."ExcludedAddress"("organizationId");
CREATE INDEX "ExcludedAddress_postalCode_idx" ON "cleaning"."ExcludedAddress"("postalCode");
CREATE INDEX "ExcludedContact_organizationId_idx" ON "cleaning"."ExcludedContact"("organizationId");
CREATE INDEX "ExcludedZone_organizationId_idx" ON "cleaning"."ExcludedZone"("organizationId");

-- AddForeignKey
ALTER TABLE "cleaning"."ServiceArea" ADD CONSTRAINT "ServiceArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ExcludedAddress" ADD CONSTRAINT "ExcludedAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ExcludedContact" ADD CONSTRAINT "ExcludedContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ExcludedZone" ADD CONSTRAINT "ExcludedZone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
