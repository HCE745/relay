-- Drop old Promotion and Referral tables
DROP TABLE IF EXISTS "Promotion";
DROP TABLE IF EXISTS "Referral";

-- Drop old enums
DROP TYPE IF EXISTS "ReferralStatus";
DROP TYPE IF EXISTS "PromotionType";
DROP TYPE IF EXISTS "PromotionAppliesTo";
DROP TYPE IF EXISTS "PromotionTriggerType";
DROP TYPE IF EXISTS "PromotionStatus";

-- Create new enums
CREATE TYPE "CreditType" AS ENUM (
  'percentage_off', 'fixed_amount', 'free_billing_cycles',
  'free_addon', 'free_intelligence_module', 'free_employee_band', 'free_location'
);

CREATE TYPE "CreditAppliesTo" AS ENUM (
  'entire_invoice', 'base_subscription', 'addons_only', 'specific_addon', 'specific_module'
);

CREATE TYPE "CreditStatus" AS ENUM (
  'pending', 'scheduled', 'active', 'completed', 'cancelled', 'expired'
);

CREATE TYPE "CreditSchedulingType" AS ENUM (
  'immediate', 'specific_date', 'after_months_active',
  'after_referral_qualification', 'after_trial_conversion'
);

CREATE TYPE "CreditDurationType" AS ENUM (
  'one_invoice', 'x_billing_cycles', 'until_date', 'until_cancelled'
);

CREATE TYPE "ReferralRewardStatus" AS ENUM (
  'pending', 'qualifying', 'qualified', 'rewarded', 'expired', 'cancelled'
);

-- Create BillingCredit table
CREATE TABLE "BillingCredit" (
  "id"                        TEXT NOT NULL,
  "orgId"                     TEXT NOT NULL,
  "creditType"                "CreditType" NOT NULL,
  "appliesTo"                 "CreditAppliesTo" NOT NULL,
  "appliesToDetail"           TEXT,
  "discountValue"             DOUBLE PRECISION NOT NULL,
  "description"               TEXT NOT NULL,
  "internalNotes"             TEXT,
  "status"                    "CreditStatus" NOT NULL DEFAULT 'pending',
  "schedulingType"            "CreditSchedulingType" NOT NULL,
  "scheduledStartDate"        TIMESTAMP(3),
  "scheduledStartAfterMonths" INTEGER,
  "durationType"              "CreditDurationType" NOT NULL,
  "durationCycles"            INTEGER,
  "durationUntilDate"         TIMESTAMP(3),
  "effectiveDate"             TIMESTAMP(3),
  "completionDate"            TIMESTAMP(3),
  "stripeCouponId"            TEXT,
  "stripeDiscountId"          TEXT,
  "createdBySuperAdminId"     TEXT NOT NULL,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"                    TEXT,
  CONSTRAINT "BillingCredit_pkey" PRIMARY KEY ("id")
);

-- Create new Referral table
CREATE TABLE "Referral" (
  "id"                          TEXT NOT NULL,
  "referrerOrgId"               TEXT NOT NULL,
  "referredOrgId"               TEXT NOT NULL,
  "referralCode"                TEXT NOT NULL,
  "signupDate"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstPaymentDate"            TIMESTAMP(3),
  "consecutiveMonthsPaid"       INTEGER NOT NULL DEFAULT 0,
  "qualificationMonthsRequired" INTEGER NOT NULL DEFAULT 6,
  "rewardStatus"                "ReferralRewardStatus" NOT NULL DEFAULT 'pending',
  "rewardDate"                  TIMESTAMP(3),
  "referrerCreditId"            TEXT,
  "referredCreditId"            TEXT,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- Add referral fields to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "referralLink" TEXT;

-- Generate unique referral codes for all existing orgs (6-char uppercase alphanumeric)
DO $$
DECLARE
  org_record RECORD;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  new_code TEXT;
  i INTEGER;
BEGIN
  FOR org_record IN SELECT id FROM "Organization" WHERE "referralCode" IS NULL LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * 36 + 1)::integer, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Organization" WHERE "referralCode" = new_code);
    END LOOP;
    UPDATE "Organization"
      SET "referralCode" = new_code,
          "referralLink" = 'https://app.getrelay.software/signup?ref=' || new_code
      WHERE id = org_record.id;
  END LOOP;
END $$;

-- Indexes
CREATE UNIQUE INDEX "Organization_referralCode_key"   ON "Organization"("referralCode");
CREATE UNIQUE INDEX "Referral_referredOrgId_key"       ON "Referral"("referredOrgId");
CREATE UNIQUE INDEX "Referral_referrerCreditId_key"    ON "Referral"("referrerCreditId");
CREATE UNIQUE INDEX "Referral_referredCreditId_key"    ON "Referral"("referredCreditId");
CREATE INDEX "BillingCredit_orgId_idx"                ON "BillingCredit"("orgId");
CREATE INDEX "BillingCredit_status_idx"               ON "BillingCredit"("status");
CREATE INDEX "BillingCredit_schedulingType_idx"       ON "BillingCredit"("schedulingType");
CREATE INDEX "Referral_referrerOrgId_idx"             ON "Referral"("referrerOrgId");
CREATE INDEX "Referral_rewardStatus_idx"              ON "Referral"("rewardStatus");
CREATE INDEX "Referral_referralCode_idx"              ON "Referral"("referralCode");

-- Foreign keys for BillingCredit
ALTER TABLE "BillingCredit"
  ADD CONSTRAINT "BillingCredit_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BillingCredit_createdBySuperAdminId_fkey"
    FOREIGN KEY ("createdBySuperAdminId") REFERENCES "SuperAdmin"("id") ON UPDATE CASCADE;

-- Foreign keys for Referral
ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_referrerOrgId_fkey"
    FOREIGN KEY ("referrerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Referral_referredOrgId_fkey"
    FOREIGN KEY ("referredOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Referral_referrerCreditId_fkey"
    FOREIGN KEY ("referrerCreditId") REFERENCES "BillingCredit"("id") ON UPDATE CASCADE,
  ADD CONSTRAINT "Referral_referredCreditId_fkey"
    FOREIGN KEY ("referredCreditId") REFERENCES "BillingCredit"("id") ON UPDATE CASCADE;

-- Migrate existing founding customer discounts to BillingCredit
-- Uses first available SuperAdmin as creator; orgs with no SA get skipped gracefully
DO $$
DECLARE
  sa_id TEXT;
  org_record RECORD;
  now_ts TIMESTAMP := NOW();
BEGIN
  SELECT id INTO sa_id FROM "SuperAdmin" LIMIT 1;
  IF sa_id IS NULL THEN RETURN; END IF;

  FOR org_record IN
    SELECT id, "discountPercent", "discountExpiresAt", "discountLabel"
    FROM "Organization"
    WHERE "discountPercent" IS NOT NULL AND "discountPercent" > 0
  LOOP
    INSERT INTO "BillingCredit" (
      "id", "orgId", "creditType", "appliesTo", "discountValue",
      "description", "internalNotes", "status", "schedulingType",
      "durationType", "durationUntilDate", "effectiveDate",
      "createdBySuperAdminId", "createdAt", "updatedAt", "reason"
    ) VALUES (
      gen_random_uuid()::text,
      org_record.id,
      'percentage_off',
      'entire_invoice',
      org_record."discountPercent",
      COALESCE(org_record."discountLabel", 'Founding customer discount'),
      'Migrated from legacy discountPercent field',
      CASE WHEN org_record."discountExpiresAt" IS NOT NULL AND org_record."discountExpiresAt" < now_ts
           THEN 'expired'
           ELSE 'active'
      END,
      'immediate',
      CASE WHEN org_record."discountExpiresAt" IS NOT NULL THEN 'until_date' ELSE 'until_cancelled' END,
      org_record."discountExpiresAt",
      now_ts,
      sa_id,
      now_ts,
      now_ts,
      'Founding customer discount'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
