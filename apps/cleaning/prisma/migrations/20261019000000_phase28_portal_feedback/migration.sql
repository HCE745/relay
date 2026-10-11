-- Phase 28: portal self-service & feedback. Additive.
CREATE TYPE "cleaning"."ServiceRequestType" AS ENUM ('RESCHEDULE', 'CANCEL');
CREATE TYPE "cleaning"."ServiceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

CREATE TABLE "cleaning"."ServiceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "cleaning"."ServiceRequestType" NOT NULL,
    "requestedDate" TEXT,
    "requestedTime" TEXT,
    "note" TEXT,
    "status" "cleaning"."ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceRequest_organizationId_idx" ON "cleaning"."ServiceRequest"("organizationId");
CREATE INDEX "ServiceRequest_status_idx" ON "cleaning"."ServiceRequest"("status");

CREATE TABLE "cleaning"."SurveyResponse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurveyResponse_jobId_key" ON "cleaning"."SurveyResponse"("jobId");
CREATE INDEX "SurveyResponse_organizationId_idx" ON "cleaning"."SurveyResponse"("organizationId");

ALTER TABLE "cleaning"."ServiceRequest" ADD CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."ServiceRequest" ADD CONSTRAINT "ServiceRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "cleaning"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "cleaning"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
