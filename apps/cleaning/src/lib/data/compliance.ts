import { orgDb, systemDb } from "../org-db"
import { satisfiesRequirement } from "../credential-status"

// Assignment compliance (Phase 13): does a cleaner hold the credentials a site
// requires? Used to warn (default) or block when assigning.

export async function getComplianceConfig(orgId: string): Promise<{ leadDays: number; block: boolean }> {
  const org = await systemDb.organization.findUnique({
    where: { id: orgId },
    select: { credentialExpiryLeadDays: true, blockAssignmentOnExpiredCredential: true },
  })
  return { leadDays: org?.credentialExpiryLeadDays ?? 30, block: org?.blockAssignmentOnExpiredCredential ?? false }
}

export type ComplianceUnmet = { type: string; reason: "missing" | "expired" }
export type ComplianceResult = { required: string[]; unmet: ComplianceUnmet[]; ok: boolean }

/**
 * Check a cleaner against a site's credential requirements as of `now`. A
 * requirement is unmet when the cleaner has no such credential ("missing") or
 * only an expired/revoked one ("expired").
 */
export async function checkAssignmentCompliance(
  orgId: string,
  userId: string,
  serviceLocationId: string,
  now: Date = new Date(),
): Promise<ComplianceResult> {
  const db = orgDb(orgId)
  const reqs = await db.siteCredentialRequirement.findMany({ where: { serviceLocationId }, select: { type: true } })
  const required = reqs.map((r) => r.type)
  if (required.length === 0) return { required: [], unmet: [], ok: true }

  const creds = await db.credential.findMany({
    where: { userId, type: { in: required as never } },
    select: { type: true, status: true, expiryDate: true },
  })
  const byType = new Map<string, { status: string; expiryDate: Date | null }[]>()
  for (const c of creds) (byType.get(c.type) ?? byType.set(c.type, []).get(c.type)!).push(c)

  const unmet: ComplianceUnmet[] = []
  for (const type of required) {
    const held = byType.get(type) ?? []
    if (held.length === 0) unmet.push({ type, reason: "missing" })
    else if (!held.some((c) => satisfiesRequirement(c, now))) unmet.push({ type, reason: "expired" })
  }
  return { required, unmet, ok: unmet.length === 0 }
}
