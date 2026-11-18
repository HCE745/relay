-- Add manager-to-representative relationship to SalesUser.
-- A sales_rep may be assigned to exactly one admin_sales manager.
-- managerId = null means unassigned (rep is visible to all managers / super-admin only).

ALTER TABLE "SalesUser" ADD COLUMN "managerId" TEXT;

ALTER TABLE "SalesUser"
  ADD CONSTRAINT "SalesUser_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "SalesUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SalesUser_managerId_idx" ON "SalesUser"("managerId");
