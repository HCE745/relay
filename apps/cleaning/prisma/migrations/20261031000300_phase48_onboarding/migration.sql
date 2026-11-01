-- Phase 48: employee onboarding packets. A reusable checklist assignable to an
-- employee (auto on hire when flagged); per-task completion is tracked with an
-- immutable record. Item labels are snapshotted onto tasks, so editing a packet
-- never rewrites someone's history.

CREATE TABLE "cleaning"."OnboardingPacket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assignOnHire" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingPacket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingPacket_organizationId_idx" ON "cleaning"."OnboardingPacket"("organizationId");
ALTER TABLE "cleaning"."OnboardingPacket" ADD CONSTRAINT "OnboardingPacket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."OnboardingPacketItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingPacketItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingPacketItem_organizationId_idx" ON "cleaning"."OnboardingPacketItem"("organizationId");
CREATE INDEX "OnboardingPacketItem_packetId_idx" ON "cleaning"."OnboardingPacketItem"("packetId");
ALTER TABLE "cleaning"."OnboardingPacketItem" ADD CONSTRAINT "OnboardingPacketItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."OnboardingPacketItem" ADD CONSTRAINT "OnboardingPacketItem_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "cleaning"."OnboardingPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."OnboardingAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packetName" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "OnboardingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingAssignment_organizationId_idx" ON "cleaning"."OnboardingAssignment"("organizationId");
CREATE INDEX "OnboardingAssignment_userId_idx" ON "cleaning"."OnboardingAssignment"("userId");
ALTER TABLE "cleaning"."OnboardingAssignment" ADD CONSTRAINT "OnboardingAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."OnboardingAssignment" ADD CONSTRAINT "OnboardingAssignment_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "cleaning"."OnboardingPacket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cleaning"."OnboardingAssignment" ADD CONSTRAINT "OnboardingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."OnboardingTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documentRef" TEXT,
    "note" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingTask_organizationId_idx" ON "cleaning"."OnboardingTask"("organizationId");
CREATE INDEX "OnboardingTask_assignmentId_idx" ON "cleaning"."OnboardingTask"("assignmentId");
ALTER TABLE "cleaning"."OnboardingTask" ADD CONSTRAINT "OnboardingTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."OnboardingTask" ADD CONSTRAINT "OnboardingTask_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "cleaning"."OnboardingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
