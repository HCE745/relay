-- Primitive: generalize the Phase 25 ExceptionAlert ledger into a general
-- IdempotencyClaim (scope,key). Hand-written rename so existing dedupe rows are
-- preserved (no re-alert burst) and the enum column becomes a plain text scope.
ALTER TABLE "cleaning"."ExceptionAlert" RENAME TO "IdempotencyClaim";
ALTER TABLE "cleaning"."IdempotencyClaim" RENAME COLUMN "event" TO "scope";
ALTER TABLE "cleaning"."IdempotencyClaim" ALTER COLUMN "scope" TYPE TEXT USING "scope"::text;
ALTER TABLE "cleaning"."IdempotencyClaim" RENAME COLUMN "entityId" TO "key";

ALTER INDEX "cleaning"."ExceptionAlert_organizationId_event_entityId_key" RENAME TO "IdempotencyClaim_organizationId_scope_key_key";
ALTER INDEX "cleaning"."ExceptionAlert_organizationId_idx" RENAME TO "IdempotencyClaim_organizationId_idx";

ALTER TABLE "cleaning"."IdempotencyClaim" RENAME CONSTRAINT "ExceptionAlert_pkey" TO "IdempotencyClaim_pkey";
ALTER TABLE "cleaning"."IdempotencyClaim" RENAME CONSTRAINT "ExceptionAlert_organizationId_fkey" TO "IdempotencyClaim_organizationId_fkey";
