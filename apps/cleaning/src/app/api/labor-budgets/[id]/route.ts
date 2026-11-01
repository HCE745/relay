import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { laborBudgetUpdateSchema } from "@/lib/zod-schemas"
import { updateLaborBudget } from "@/lib/data/labor-budgets"

const CAP = "erp.laborBudgets"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(laborBudgetUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateLaborBudget(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate — the budget stops appearing in variance going forward.
  return runWrite(() => updateLaborBudget(g.orgId, id, { isActive: false }))
}
