-- Phase 34: link issues to assets (issue history on equipment). Additive.
ALTER TABLE "cleaning"."Issue" ADD COLUMN "assetId" TEXT;
CREATE INDEX "Issue_assetId_idx" ON "cleaning"."Issue"("assetId");
ALTER TABLE "cleaning"."Issue" ADD CONSTRAINT "Issue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "cleaning"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
