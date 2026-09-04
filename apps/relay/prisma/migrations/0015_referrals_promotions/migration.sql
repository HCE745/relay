-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'qualifying', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('percent_discount', 'fixed_discount', 'free_months', 'fixed_price_override');

-- CreateEnum
CREATE TYPE "PromotionAppliesTo" AS ENUM ('base_plan', 'modules', 'entire_order');

-- CreateEnum
CREATE TYPE "PromotionTriggerType" AS ENUM ('manual', 'automatic_date', 'referral_completion');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('active', 'pending', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerOrgId" TEXT NOT NULL,
    "referredOrgId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "rewardTriggeredAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "promotionType" "PromotionType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "appliesTo" "PromotionAppliesTo" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "triggerType" "PromotionTriggerType" NOT NULL,
    "triggerCondition" JSONB,
    "status" "PromotionStatus" NOT NULL DEFAULT 'pending',
    "stripeCouponId" TEXT,
    "referralId" TEXT,
    "createdBySuperAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredOrgId_key" ON "Referral"("referredOrgId");
CREATE INDEX "Referral_referrerOrgId_idx" ON "Referral"("referrerOrgId");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");
CREATE INDEX "Promotion_orgId_idx" ON "Promotion"("orgId");
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");
CREATE INDEX "Promotion_referralId_idx" ON "Promotion"("referralId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerOrgId_fkey" FOREIGN KEY ("referrerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredOrgId_fkey" FOREIGN KEY ("referredOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdBySuperAdminId_fkey" FOREIGN KEY ("createdBySuperAdminId") REFERENCES "SuperAdmin"("id") ON UPDATE CASCADE;
