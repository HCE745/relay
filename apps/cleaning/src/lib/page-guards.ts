import "server-only"
import { getOrgCapabilities } from "./entitlements-server"

// Server-side capability guard for pages. Nav hides capability-gated items, but
// a user could still navigate directly — so gated pages call this too.
export async function orgHasCapability(organizationId: string, capability: string): Promise<boolean> {
  const caps = await getOrgCapabilities(organizationId)
  return caps.includes(capability)
}
