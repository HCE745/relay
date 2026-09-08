-- Enable Customer Voice for all existing Professional-and-above organizations.
-- New orgs can be toggled per-org via the super-admin feature flags panel.
UPDATE "Organization"
SET customer_voice_enabled = true
WHERE plan IN ('free', 'professional', 'professional_plus', 'enterprise', 'custom', 'pro', 'starter');
