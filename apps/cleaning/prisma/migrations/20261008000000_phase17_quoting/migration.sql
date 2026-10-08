-- CreateEnum
CREATE TYPE "cleaning"."QuoteSource" AS ENUM ('PHONE', 'ONLINE', 'IN_PERSON', 'REFERRAL');
CREATE TYPE "cleaning"."PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');
CREATE TYPE "cleaning"."QuoteRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "cleaning"."QuoteRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "cleaning"."QuoteSource" NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "propertyType" "cleaning"."PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
    "sqft" INTEGER,
    "frequency" "cleaning"."ServiceFrequency",
    "notes" TEXT,
    "requestedDate" TIMESTAMP(3),
    "status" "cleaning"."QuoteRequestStatus" NOT NULL DEFAULT 'NEW',
    "walkthrough" JSONB,
    "outsideServiceArea" BOOLEAN NOT NULL DEFAULT false,
    "convertedLeadId" TEXT,
    "convertedEstimateId" TEXT,
    "ipHash" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteRequest_organizationId_idx" ON "cleaning"."QuoteRequest"("organizationId");
CREATE INDEX "QuoteRequest_status_idx" ON "cleaning"."QuoteRequest"("status");

-- AddForeignKey
ALTER TABLE "cleaning"."QuoteRequest" ADD CONSTRAINT "QuoteRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
