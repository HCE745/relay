-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "condCategory" TEXT,
    "condLocationId" TEXT,
    "condDeptId" TEXT,
    "condAssetType" TEXT,
    "condPriority" TEXT,
    "assignToUserId" TEXT,
    "assignToRole" TEXT,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_condLocationId_fkey"
    FOREIGN KEY ("condLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_condDeptId_fkey"
    FOREIGN KEY ("condDeptId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_assignToUserId_fkey"
    FOREIGN KEY ("assignToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
