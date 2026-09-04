-- DropForeignKey
ALTER TABLE "FeatureRequest" DROP CONSTRAINT "FeatureRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "FeatureRequest" DROP CONSTRAINT "FeatureRequest_submittedById_fkey";

-- AlterTable
ALTER TABLE "FeatureRequest" ADD COLUMN     "feedbackType" TEXT NOT NULL DEFAULT 'feature_request',
ADD COLUMN     "submitterEmail" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "submittedById" DROP NOT NULL,
ALTER COLUMN "submittedByRole" SET DEFAULT '',
ALTER COLUMN "orgName" SET DEFAULT '',
ALTER COLUMN "useCase" DROP NOT NULL,
ALTER COLUMN "frequency" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FeatureRequest_feedbackType_idx" ON "FeatureRequest"("feedbackType");

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

