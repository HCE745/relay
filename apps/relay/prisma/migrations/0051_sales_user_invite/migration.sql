-- SalesUserInvite: secure single-use invitation tokens for CRM onboarding
CREATE TABLE "SalesUserInvite" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "salesUserId" TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "usedAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesUserInvite_salesUserId_fkey"
    FOREIGN KEY ("salesUserId") REFERENCES "SalesUser"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "SalesUserInvite_tokenHash_key" ON "SalesUserInvite"("tokenHash");
CREATE INDEX "SalesUserInvite_salesUserId_idx"      ON "SalesUserInvite"("salesUserId");

-- invitePending: true while the user has not yet completed their invitation
ALTER TABLE "SalesUser" ADD COLUMN IF NOT EXISTS "invitePending" BOOLEAN NOT NULL DEFAULT false;
