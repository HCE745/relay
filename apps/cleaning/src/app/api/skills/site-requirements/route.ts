import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { siteSkillRequirementsSchema } from "@/lib/zod-schemas"
import { setSiteSkillRequirements } from "@/lib/data/skills"

const CAP = "workforce.coverage"

// Replace a site's required-skill set (the management grid sends the full list).
export async function PATCH(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(siteSkillRequirementsSchema, request); if (!body.ok) return body.response
  return runWrite(() => setSiteSkillRequirements(g.orgId, body.data.serviceLocationId, body.data.skillIds))
}
