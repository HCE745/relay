import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { servicePlanCreateSchema } from "@/lib/zod-schemas"
import { createServicePlan } from "@/lib/data/service-plans"

const CAP = "core.servicePlans"

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(servicePlanCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createServicePlan(g.orgId, body.data), { created: true })
}
