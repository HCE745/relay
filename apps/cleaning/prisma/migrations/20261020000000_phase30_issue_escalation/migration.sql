-- Phase 30: issue ownership, deadlines & escalation. Additive.
CREATE TYPE "cleaning"."IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE 'ISSUE_ASSIGNED';
ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE 'ISSUE_UNACKED';
ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE 'ISSUE_OVERDUE';
ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE 'ISSUE_ESCALATED';

ALTER TABLE "cleaning"."Issue"
  ADD COLUMN "verifierId" TEXT,
  ADD COLUMN "severity" "cleaning"."IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "ackDeadline" TIMESTAMP(3),
  ADD COLUMN "resolveDeadline" TIMESTAMP(3),
  ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reopenCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "externalReporter" TEXT;

ALTER TABLE "cleaning"."Organization" ADD COLUMN "issueEscalationEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "cleaning"."IssueSlaRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "severity" "cleaning"."IssueSeverity" NOT NULL,
    "ackMinutes" INTEGER NOT NULL,
    "resolveMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IssueSlaRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IssueSlaRule_organizationId_severity_key" ON "cleaning"."IssueSlaRule"("organizationId", "severity");
CREATE INDEX "IssueSlaRule_organizationId_idx" ON "cleaning"."IssueSlaRule"("organizationId");

ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."IssueSlaRule" ADD CONSTRAINT "IssueSlaRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
