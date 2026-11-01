import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { laborBudgetSchema } from "@/lib/zod-schemas"
import { listLaborBudgets, createLaborBudget } from "@/lib/data/labor-budgets"

const CAP = "erp.laborBudgets"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listLaborBudgets(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(laborBudgetSchema, request); if (!body.ok) return body.response
  return runWrite(() => createLaborBudget(g.orgId, body.data), { created: true })
}
