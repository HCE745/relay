-- Add the NOT_RETURNED custody action in its OWN migration so the ADD VALUE
-- commits before any later migration or runtime code uses it (CLIENT-role pattern).
ALTER TYPE "cleaning"."CustodyAction" ADD VALUE IF NOT EXISTS 'NOT_RETURNED';
