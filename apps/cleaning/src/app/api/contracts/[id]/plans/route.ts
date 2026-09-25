import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { contractPlansSchema } from "@/lib/zod-schemas"
import { setContractPlans } from "@/lib/data/contracts"

const CAP = "crm.contracts"
type Ctx = { params: Promise<{ id: string }> }

// Replace the set of service plans linked to this contract (optional linking).
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(contractPlansSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setContractPlans(g.orgId, id, body.data.planIds))
}
