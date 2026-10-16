-- Phase 36 offboarding override: items a departed employee never returned stay
-- on the outstanding report, flagged as unrecovered. Additive.
ALTER TABLE "cleaning"."AccessItem" ADD COLUMN "custodyNotReturned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cleaning"."Asset" ADD COLUMN "custodyNotReturned" BOOLEAN NOT NULL DEFAULT false;
