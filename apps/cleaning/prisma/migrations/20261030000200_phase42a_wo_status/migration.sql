-- Phase 42a: new WorkOrder statuses for the corrective resolve/verify flow.
-- Isolated from any use of the values (Postgres enum ADD VALUE precedent).
ALTER TYPE "cleaning"."WorkOrderStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "cleaning"."WorkOrderStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
