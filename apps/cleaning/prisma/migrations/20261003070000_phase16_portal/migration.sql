-- CreateEnum
CREATE TYPE "cleaning"."IssueSource" AS ENUM ('STAFF', 'CUSTOMER', 'INSPECTION');

-- AlterTable
ALTER TABLE "cleaning"."Issue" ADD COLUMN     "source" "cleaning"."IssueSource" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "cleaning"."User" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."PortalInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "acceptedUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalInvite_token_key" ON "cleaning"."PortalInvite"("token");
CREATE INDEX "PortalInvite_organizationId_idx" ON "cleaning"."PortalInvite"("organizationId");
CREATE INDEX "PortalInvite_customerId_idx" ON "cleaning"."PortalInvite"("customerId");

-- AddForeignKey
ALTER TABLE "cleaning"."User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."PortalInvite" ADD CONSTRAINT "PortalInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."PortalInvite" ADD CONSTRAINT "PortalInvite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
