-- Migration 0037: P1 production-readiness fixes
-- Adds canceledAt to Organization, composite indexes on Issue/Asset,
-- and fixes any remaining "cancelled" → "canceled" data inconsistency.

-- Add canceledAt column to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);

-- Fix data: normalize subscriptionStatus spelling (British → American)
UPDATE "Organization"
SET "subscriptionStatus" = 'canceled'
WHERE "subscriptionStatus" = 'cancelled';

-- Composite indexes on Issue for common query patterns
CREATE INDEX IF NOT EXISTS "Issue_organizationId_status_idx"     ON "Issue"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Issue_organizationId_priority_idx"   ON "Issue"("organizationId", "priority");
CREATE INDEX IF NOT EXISTS "Issue_organizationId_createdAt_idx"  ON "Issue"("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Issue_organizationId_assignedToId_idx" ON "Issue"("organizationId", "assignedToId");
CREATE INDEX IF NOT EXISTS "Issue_organizationId_locationId_idx" ON "Issue"("organizationId", "locationId");

-- Composite indexes on Asset
CREATE INDEX IF NOT EXISTS "Asset_organizationId_status_idx" ON "Asset"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Asset_organizationId_name_idx"   ON "Asset"("organizationId", "name");
