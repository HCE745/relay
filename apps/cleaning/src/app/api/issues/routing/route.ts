import { requireOperations } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { routingRuleSchema } from "@/lib/zod-schemas"
import { listRoutingRules, createRoutingRule, toRoutingRuleInput } from "@/lib/data/issue-routing"

const CAP = "operations.issues"

export async function GET() {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  return ok(await listRoutingRules(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(routingRuleSchema, request); if (!body.ok) return body.response
  return runWrite(() => createRoutingRule(g.orgId, g.userId, toRoutingRuleInput(body.data)), { created: true })
}
