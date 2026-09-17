-- Add ON DELETE SET NULL to all nullable FK relations that previously had no onDelete rule.
-- This prevents DELETE operations on referenced records from being silently RESTRICTED.

-- ─── User ────────────────────────────────────────────────────────────────────

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_departmentId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_locationId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_regionId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_managerId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_employeeTypeId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_employeeTypeId_fkey"
  FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Location ─────────────────────────────────────────────────────────────────

ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_parentId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_regionId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Department ───────────────────────────────────────────────────────────────

ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_locationId_fkey";
ALTER TABLE "Department" ADD CONSTRAINT "Department_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Asset ────────────────────────────────────────────────────────────────────

ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_locationId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_departmentId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_vendorId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Issue ────────────────────────────────────────────────────────────────────

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_locationId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_departmentId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_assetId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_vendorId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_sopId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sopId_fkey"
  FOREIGN KEY ("sopId") REFERENCES "SOP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Notification ─────────────────────────────────────────────────────────────

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_issueId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── RoutingRule ──────────────────────────────────────────────────────────────

ALTER TABLE "RoutingRule" DROP CONSTRAINT IF EXISTS "RoutingRule_condLocationId_fkey";
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_condLocationId_fkey"
  FOREIGN KEY ("condLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoutingRule" DROP CONSTRAINT IF EXISTS "RoutingRule_condDeptId_fkey";
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_condDeptId_fkey"
  FOREIGN KEY ("condDeptId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── EscalationPolicy ────────────────────────────────────────────────────────

ALTER TABLE "EscalationPolicy" DROP CONSTRAINT IF EXISTS "EscalationPolicy_departmentId_fkey";
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── MaintenanceLog ───────────────────────────────────────────────────────────

ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_vendorId_fkey";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── MaintenanceSchedule ─────────────────────────────────────────────────────

ALTER TABLE "MaintenanceSchedule" DROP CONSTRAINT IF EXISTS "MaintenanceSchedule_locationId_fkey";
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
