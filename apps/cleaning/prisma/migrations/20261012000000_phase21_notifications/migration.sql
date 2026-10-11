-- Phase 21: SMS + email notifications. Additive.

-- CreateEnum
CREATE TYPE "cleaning"."NotificationEvent" AS ENUM ('JOB_ASSIGNED', 'ASSIGNMENT_CHANGED', 'SCHEDULE_CHANGED', 'SHIFT_UNCOVERED', 'TIMEOFF_APPROVED', 'TIMEOFF_DECLINED', 'MISSED_CLOCK_IN', 'CREDENTIAL_EXPIRING', 'VISIT_REMINDER', 'SERVICE_SUMMARY', 'PAYMENT_REMINDER', 'CUSTOMER_MESSAGE');
CREATE TYPE "cleaning"."NotificationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "cleaning"."NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "cleaning"."User" ADD COLUMN "smsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cleaning"."NotificationPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "cleaning"."NotificationEvent" NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_event_key" ON "cleaning"."NotificationPreference"("userId", "event");
CREATE INDEX "NotificationPreference_organizationId_idx" ON "cleaning"."NotificationPreference"("organizationId");

-- CreateTable
CREATE TABLE "cleaning"."NotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "cleaning"."NotificationChannel" NOT NULL,
    "event" "cleaning"."NotificationEvent" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "cleaning"."NotificationStatus" NOT NULL,
    "detail" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationLog_organizationId_idx" ON "cleaning"."NotificationLog"("organizationId");
CREATE INDEX "NotificationLog_userId_event_channel_createdAt_idx" ON "cleaning"."NotificationLog"("userId", "event", "channel", "createdAt");

-- Foreign keys
ALTER TABLE "cleaning"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."NotificationLog" ADD CONSTRAINT "NotificationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
