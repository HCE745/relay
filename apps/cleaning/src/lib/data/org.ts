import { systemDb } from "../org-db"

/** The org's default scheduling timezone (used for schedule grouping/fallback). */
export async function getOrgTimezone(orgId: string): Promise<string> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { timezone: true } })
  return org?.timezone ?? "America/New_York"
}

export async function getOrgSettings(orgId: string) {
  return systemDb.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, packageTier: true, timezone: true },
  })
}

/** Update the org's default timezone (OWNER/ADMIN only, enforced in the route). */
export async function updateOrgTimezone(orgId: string, timezone: string) {
  return systemDb.organization.update({ where: { id: orgId }, data: { timezone } })
}
