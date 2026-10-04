-- Add the CLIENT role value in its OWN migration so the ADD VALUE commits
-- before any later migration or runtime code uses it. (Postgres allows
-- ALTER TYPE ... ADD VALUE, but the new value cannot be USED in the same
-- transaction — isolating it here removes all doubt.)
ALTER TYPE "cleaning"."UserRole" ADD VALUE IF NOT EXISTS 'CLIENT';
