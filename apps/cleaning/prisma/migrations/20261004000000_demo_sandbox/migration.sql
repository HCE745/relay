-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
ADD COLUMN     "demoIpHash" TEXT;

-- CreateIndex
CREATE INDEX "Organization_isDemo_demoExpiresAt_idx" ON "cleaning"."Organization"("isDemo", "demoExpiresAt");
