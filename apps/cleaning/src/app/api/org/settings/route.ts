import { requireOrgAdmin } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { orgSettingsSchema } from "@/lib/zod-schemas"
import { updateOrgTimezone } from "@/lib/data/org"

// Organization timezone (OWNER/ADMIN). IANA-validated by the Zod schema.
export async function PATCH(request: Request) {
  const g = await requireOrgAdmin()
  if (!g.ok) return g.response
  const body = await parseBody(orgSettingsSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateOrgTimezone(g.orgId, body.data.timezone))
}
