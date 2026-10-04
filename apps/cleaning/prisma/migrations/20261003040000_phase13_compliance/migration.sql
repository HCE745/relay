-- CreateEnum
CREATE TYPE "cleaning"."CredentialType" AS ENUM ('BACKGROUND_CHECK', 'INSURANCE', 'I9', 'BONDING', 'CERTIFICATION', 'LICENSE', 'TRAINING');

-- CreateEnum
CREATE TYPE "cleaning"."CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "credentialExpiryLeadDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "blockAssignmentOnExpiredCredential" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cleaning"."Credential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "cleaning"."CredentialType" NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentRef" TEXT,
    "status" "cleaning"."CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."SiteCredentialRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "type" "cleaning"."CredentialType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCredentialRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Credential_organizationId_idx" ON "cleaning"."Credential"("organizationId");
CREATE INDEX "Credential_userId_idx" ON "cleaning"."Credential"("userId");
CREATE INDEX "SiteCredentialRequirement_organizationId_idx" ON "cleaning"."SiteCredentialRequirement"("organizationId");
CREATE UNIQUE INDEX "SiteCredentialRequirement_serviceLocationId_type_key" ON "cleaning"."SiteCredentialRequirement"("serviceLocationId", "type");

-- AddForeignKey
ALTER TABLE "cleaning"."Credential" ADD CONSTRAINT "Credential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SiteCredentialRequirement" ADD CONSTRAINT "SiteCredentialRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SiteCredentialRequirement" ADD CONSTRAINT "SiteCredentialRequirement_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
