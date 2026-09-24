import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { leadUpdateSchema } from "@/lib/zod-schemas"
import { updateLead } from "@/lib/data/leads"

const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(leadUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateLead(g.orgId, id, body.data))
}
