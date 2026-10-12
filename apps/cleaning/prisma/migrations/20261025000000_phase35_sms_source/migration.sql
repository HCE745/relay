-- Phase 35: SMS issue intake. Additive — new IssueSource value only, alone in
-- its own migration (ADD VALUE commits before it's used), matching the CLIENT
-- role precedent.
ALTER TYPE "cleaning"."IssueSource" ADD VALUE IF NOT EXISTS 'SMS';
