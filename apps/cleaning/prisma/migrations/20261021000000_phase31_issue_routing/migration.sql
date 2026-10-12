-- Phase 31: issue routing rules. Additive.
ALTER TABLE "cleaning"."Organization" ADD COLUMN "defaultIssueAssigneeId" TEXT;

CREATE TABLE "cleaning"."IssueRoutingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" "cleaning"."IssueCategory",
    "severity" "cleaning"."IssueSeverity",
    "source" "cleaning"."IssueSource",
    "serviceLocationId" TEXT,
    "assignToId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IssueRoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IssueRoutingRule_organizationId_isActive_priority_idx" ON "cleaning"."IssueRoutingRule"("organizationId", "isActive", "priority");

ALTER TABLE "cleaning"."IssueRoutingRule" ADD CONSTRAINT "IssueRoutingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."IssueRoutingRule" ADD CONSTRAINT "IssueRoutingRule_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."IssueRoutingRule" ADD CONSTRAINT "IssueRoutingRule_assignToId_fkey" FOREIGN KEY ("assignToId") REFERENCES "cleaning"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
