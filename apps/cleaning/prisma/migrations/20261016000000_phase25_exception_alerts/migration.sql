-- Phase 25: push alerts for operational exceptions. Additive.
ALTER TABLE "cleaning"."Organization"
  ADD COLUMN "uncoveredAlertLeadHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "missedClockInGraceMin" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "cleaning"."ExceptionAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "event" "cleaning"."NotificationEvent" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExceptionAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExceptionAlert_organizationId_event_entityId_key" ON "cleaning"."ExceptionAlert"("organizationId", "event", "entityId");
CREATE INDEX "ExceptionAlert_organizationId_idx" ON "cleaning"."ExceptionAlert"("organizationId");
ALTER TABLE "cleaning"."ExceptionAlert" ADD CONSTRAINT "ExceptionAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
