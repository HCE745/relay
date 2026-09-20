-- CreateTable
CREATE TABLE "OrgAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgAnalyticsEvent_organizationId_eventType_idx" ON "OrgAnalyticsEvent"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "OrgAnalyticsEvent_createdAt_idx" ON "OrgAnalyticsEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "OrgAnalyticsEvent" ADD CONSTRAINT "OrgAnalyticsEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
