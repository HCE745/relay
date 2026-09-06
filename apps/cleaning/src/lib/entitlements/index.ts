// Public surface of the entitlements layer.
export { CAPABILITIES, isCapability, type Capability } from "./capabilities"
export {
  PACKAGE_CAPABILITIES,
  PACKAGE_ORDER,
  capabilitiesForTier,
  type PackageTier,
} from "./packages"
export {
  canUse,
  resolveCapabilities,
  parseOverrides,
  type CapabilityOverrides,
  type EntitlementContext,
} from "./can-use"
export { CapabilityProvider, useCanUse } from "./context"
export { Gate } from "./gate"
