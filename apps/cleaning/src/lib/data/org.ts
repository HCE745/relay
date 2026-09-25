import { systemDb } from "../org-db"

/** The org's default scheduling timezone (used for schedule grouping/fallback). */
export async function getOrgTimezone(orgId: string): Promise<string> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { timezone: true } })
  return org?.timezone ?? "America/New_York"
}

export async function getOrgSettings(orgId: string) {
  return systemDb.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, packageTier: true, timezone: true, contractExpiryLeadDays: true },
  })
}

/** The configurable lead time for the expiring-contracts dashboard warning. */
export async function getContractExpiryLeadDays(orgId: string): Promise<number> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { contractExpiryLeadDays: true } })
  return org?.contractExpiryLeadDays ?? 60
}

/** Update org workspace settings (OWNER/ADMIN only, enforced in the route). */
export async function updateOrgSettings(orgId: string, input: { timezone?: string; contractExpiryLeadDays?: number }) {
  const data: Record<string, unknown> = {}
  if (input.timezone !== undefined) data.timezone = input.timezone
  if (input.contractExpiryLeadDays !== undefined) data.contractExpiryLeadDays = input.contractExpiryLeadDays
  return systemDb.organization.update({ where: { id: orgId }, data })
}
