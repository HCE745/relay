-- Phase 49: shared time-clock kiosk. A device at a site/office where a crew
-- clocks in/out. Each punch still creates a per-user TimeEntry through the normal
-- clock path and is audited with the kiosk id — a shared device never weakens
-- per-user time integrity. Employees are identified by a hashed clock PIN.

ALTER TABLE "cleaning"."EmployeeProfile" ADD COLUMN "clockPinHash" TEXT;

CREATE TABLE "cleaning"."TimeClockKiosk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceLocationId" TEXT,
    "deviceTokenHash" TEXT NOT NULL,
    "pinRequired" BOOLEAN NOT NULL DEFAULT true,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeClockKiosk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimeClockKiosk_organizationId_idx" ON "cleaning"."TimeClockKiosk"("organizationId");
ALTER TABLE "cleaning"."TimeClockKiosk" ADD CONSTRAINT "TimeClockKiosk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."TimeClockKiosk" ADD CONSTRAINT "TimeClockKiosk_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
