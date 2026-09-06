import { systemDb } from "../org-db"

/** The org's default scheduling timezone (used for schedule grouping/fallback). */
export async function getOrgTimezone(orgId: string): Promise<string> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { timezone: true } })
  return org?.timezone ?? "America/New_York"
}
