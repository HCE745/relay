import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { bidInputsSchema } from "@/lib/zod-schemas"
import { saveEstimateBid } from "@/lib/data/bid"

const CAP = "crm.bidCalculator"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(bidInputsSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => saveEstimateBid(g.orgId, id, body.data))
}
