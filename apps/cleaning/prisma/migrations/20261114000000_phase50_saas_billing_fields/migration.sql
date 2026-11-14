-- Phase 50: CleanWare SaaS subscription billing — schema foundations.
--
-- Purely ADDITIVE and safe to run on a live database:
--   * Six new Organization columns, all nullable or with a constant default
--     (purchasedSeats = 0, cancelAtPeriodEnd = false), so EXISTING rows are left
--     unchanged and adding them is a fast metadata-only change (no table rewrite).
--   * A new EmailVerificationToken table (mirrors PasswordResetToken).
--   * Unique indexes on the two Stripe identifiers — Postgres permits many NULLs,
--     so existing orgs (all NULL) are fine; this binds one org to at most one
--     Stripe customer/subscription.
--
-- Adding these columns does NOT activate any enforcement: no code reads them for
-- access control yet, and no existing organization's access changes as a result.
-- There are no drops, no NOT-NULL backfills, and no changes to Customer or any
-- other existing data.

-- AlterTable
ALTER TABLE "cleaning"."Organization" ADD COLUMN     "billingInterval" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "purchasedSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "cleaning"."EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "cleaning"."EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "cleaning"."Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "cleaning"."Organization"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "cleaning"."EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
