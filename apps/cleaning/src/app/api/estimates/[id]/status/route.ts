import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { estimateStatusSchema } from "@/lib/zod-schemas"
import { setEstimateStatus } from "@/lib/data/estimates"

const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(estimateStatusSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setEstimateStatus(g.orgId, id, body.data.status))
}
