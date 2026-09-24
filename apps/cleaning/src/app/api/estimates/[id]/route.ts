import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok, notFound } from "@/lib/api"
import { estimateUpdateSchema } from "@/lib/zod-schemas"
import { getEstimate, updateEstimate } from "@/lib/data/estimates"

const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const est = await getEstimate(g.orgId, id)
  return est ? ok(est) : notFound()
}

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(estimateUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateEstimate(g.orgId, id, body.data))
}
