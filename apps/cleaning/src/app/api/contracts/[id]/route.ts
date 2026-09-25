import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { contractUpdateSchema } from "@/lib/zod-schemas"
import { updateContract } from "@/lib/data/contracts"

const CAP = "crm.contracts"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(contractUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateContract(g.orgId, id, body.data))
}
