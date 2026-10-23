-- CreateTable
CREATE TABLE "DashboardLayout" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById"    TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "isDefault"      BOOLEAN NOT NULL DEFAULT false,
    "layoutType"     TEXT NOT NULL DEFAULT 'PERSONAL',
    "widgets"        JSONB NOT NULL DEFAULT '[]',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardLayout_organizationId_idx" ON "DashboardLayout"("organizationId");

-- CreateIndex
CREATE INDEX "DashboardLayout_createdById_idx" ON "DashboardLayout"("createdById");

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
