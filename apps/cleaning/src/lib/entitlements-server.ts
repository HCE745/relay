import "server-only"
import { prisma } from "./prisma"
import { resolveCapabilities, parseOverrides, type PackageTier } from "./entitlements"

// Resolve an org's effective capability list on the server (tier + overrides).
// Overrides live in the DB (not the JWT) so a plan/add-on change takes effect
// immediately without re-issuing sessions.
export async function getOrgCapabilities(organizationId: string): Promise<string[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { packageTier: true, capabilityOverrides: true },
  })
  if (!org) return []
  const caps = resolveCapabilities({
    packageTier: org.packageTier as PackageTier,
    capabilityOverrides: parseOverrides(org.capabilityOverrides),
  })
  return [...caps]
}
