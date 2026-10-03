-- CreateEnum
CREATE TYPE "cleaning"."AvailabilitySource" AS ENUM ('MANAGER', 'TIME_OFF');

-- CreateEnum
CREATE TYPE "cleaning"."TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "cleaning"."Availability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "source" "cleaning"."AvailabilitySource" NOT NULL DEFAULT 'MANAGER',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."TimeOffRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "cleaning"."TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_organizationId_idx" ON "cleaning"."Availability"("organizationId");
CREATE INDEX "Availability_userId_idx" ON "cleaning"."Availability"("userId");
CREATE INDEX "TimeOffRequest_organizationId_idx" ON "cleaning"."TimeOffRequest"("organizationId");
CREATE INDEX "TimeOffRequest_userId_idx" ON "cleaning"."TimeOffRequest"("userId");
CREATE INDEX "TimeOffRequest_status_idx" ON "cleaning"."TimeOffRequest"("status");

-- AddForeignKey
ALTER TABLE "cleaning"."Availability" ADD CONSTRAINT "Availability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
