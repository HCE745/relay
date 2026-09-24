import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { supplyUpdateSchema } from "@/lib/zod-schemas"
import { updateSupply } from "@/lib/data/supplies"

const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(supplyUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateSupply(g.orgId, id, body.data))
}
