import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { routingRuleSchema } from "@/lib/zod-schemas"
import { updateRoutingRule, deleteRoutingRule, toRoutingRuleInput } from "@/lib/data/issue-routing"

const CAP = "operations.issues"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(routingRuleSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateRoutingRule(g.orgId, g.userId, id, toRoutingRuleInput(body.data)))
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => deleteRoutingRule(g.orgId, g.userId, id))
}
