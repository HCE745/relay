import { requireOrgAdmin } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { orgSettingsSchema } from "@/lib/zod-schemas"
import { updateOrgSettings } from "@/lib/data/org"

// Organization workspace settings (OWNER/ADMIN): scheduling timezone and the
// expiring-contract warning lead time. Only provided fields are updated.
export async function PATCH(request: Request) {
  const g = await requireOrgAdmin()
  if (!g.ok) return g.response
  const body = await parseBody(orgSettingsSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateOrgSettings(g.orgId, body.data))
}
