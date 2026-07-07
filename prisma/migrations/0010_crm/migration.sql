-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "lifecycleStatus" TEXT NOT NULL DEFAULT 'Lead';

-- CreateTable
CREATE TABLE "DemoCall" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "companyName" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "locationCount" INTEGER,
    "leadSource" TEXT NOT NULL DEFAULT 'Other',
    "scheduledAt" TIMESTAMP(3),
    "callStatus" TEXT NOT NULL DEFAULT 'Scheduled',
    "callNotes" TEXT,
    "painPoints" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpCompleted" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "organizationId" TEXT,
    "createdBySAName" TEXT NOT NULL,
    "calendlyEventId" TEXT,
    "calendlyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConversionReason" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "notedBySAName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonConversionReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "createdBySAName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBySAName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoCall_organizationId_idx" ON "DemoCall"("organizationId");
CREATE INDEX "DemoCall_scheduledAt_idx" ON "DemoCall"("scheduledAt");
CREATE INDEX "DemoCall_followUpDate_idx" ON "DemoCall"("followUpDate");
CREATE INDEX "DemoCall_callStatus_idx" ON "DemoCall"("callStatus");
CREATE INDEX "DemoCall_calendlyEventId_idx" ON "DemoCall"("calendlyEventId");
CREATE INDEX "NonConversionReason_organizationId_idx" ON "NonConversionReason"("organizationId");
CREATE INDEX "NonConversionReason_reasonCategory_idx" ON "NonConversionReason"("reasonCategory");
CREATE INDEX "CrmNote_organizationId_idx" ON "CrmNote"("organizationId");
CREATE INDEX "CrmNote_createdAt_idx" ON "CrmNote"("createdAt");
CREATE INDEX "CrmActivity_organizationId_idx" ON "CrmActivity"("organizationId");
CREATE INDEX "CrmActivity_createdAt_idx" ON "CrmActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "DemoCall" ADD CONSTRAINT "DemoCall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NonConversionReason" ADD CONSTRAINT "NonConversionReason_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
