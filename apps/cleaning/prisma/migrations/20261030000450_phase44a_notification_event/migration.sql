-- Phase 44a: new NotificationEvent value for collection-step sends.
-- Isolated from any use of the value (Postgres enum ADD VALUE precedent).
ALTER TYPE "cleaning"."NotificationEvent" ADD VALUE IF NOT EXISTS 'COLLECTION_STEP';
