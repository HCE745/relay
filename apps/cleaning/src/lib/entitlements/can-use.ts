// canUse() — the one function product code calls to gate a feature.
//
// Capabilities are computed at read time from (tier + per-org overrides). We do
// NOT materialize them into boolean columns (Relay's approach), so changing a
// package definition instantly re-derives every org's access with no backfill.

import type { Capability } from "./capabilities"
import { isCapability } from "./capabilities"
import { capabilitiesForTier, type PackageTier } from "./packages"

/** Per-org adjustments layered on top of the tier's base set. */
export type CapabilityOverrides = {
  add?: string[]    // grant capabilities beyond the tier (e.g. an add-on)
  remove?: string[] // revoke capabilities the tier would otherwise include
}

/** Minimal entitlement context — derivable from an Organization row. */
export type EntitlementContext = {
  packageTier: PackageTier
  capabilityOverrides?: CapabilityOverrides | null
}

/**
 * Resolve the full effective capability set for an org: tier base, plus `add`,
 * minus `remove`. `remove` wins over `add` so a revocation is always honored.
 */
export function resolveCapabilities(ctx: EntitlementContext): Set<Capability> {
  const effective = new Set<Capability>(capabilitiesForTier(ctx.packageTier))

  const add = ctx.capabilityOverrides?.add ?? []
  for (const cap of add) {
    if (isCapability(cap)) effective.add(cap)
  }

  const remove = ctx.capabilityOverrides?.remove ?? []
  for (const cap of remove) {
    if (isCapability(cap)) effective.delete(cap)
  }

  return effective
}

/** True if the org may use the capability. Unknown keys are always false. */
export function canUse(ctx: EntitlementContext, capability: string): boolean {
  if (!isCapability(capability)) return false
  return resolveCapabilities(ctx).has(capability)
}

/**
 * Coerce an Organization's JSON overrides column into a typed object. Prisma
 * returns `Json` as `unknown`; this validates the shape defensively.
 */
export function parseOverrides(value: unknown): CapabilityOverrides | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const asStrings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []
  return { add: asStrings(v.add), remove: asStrings(v.remove) }
}
