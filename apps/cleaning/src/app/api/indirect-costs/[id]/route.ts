import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { indirectCostUpdateSchema } from "@/lib/zod-schemas"
import { updateIndirectCostPool } from "@/lib/data/indirect-costs"

const CAP = "erp.siteProfitability"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(indirectCostUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateIndirectCostPool(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate — the report simply stops allocating this pool going forward.
  return runWrite(() => updateIndirectCostPool(g.orgId, id, { isActive: false }))
}
