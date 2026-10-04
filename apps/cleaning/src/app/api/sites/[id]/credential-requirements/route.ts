import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { siteRequirementsSchema } from "@/lib/zod-schemas"
import { listSiteRequirements, setSiteRequirements } from "@/lib/data/credentials"

const CAP = "workforce.compliance"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return ok(await listSiteRequirements(g.orgId, id))
}

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(siteRequirementsSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setSiteRequirements(g.orgId, id, body.data.types))
}
