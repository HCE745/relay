-- Add the PAYROLL_EARNINGS export type in its OWN migration so the ADD VALUE
-- commits before runtime code uses it (CLIENT-role pattern).
ALTER TYPE "cleaning"."ExportType" ADD VALUE IF NOT EXISTS 'PAYROLL_EARNINGS';
