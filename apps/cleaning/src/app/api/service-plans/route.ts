import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, forbidden } from "@/lib/api"
import { servicePlanCreateSchema } from "@/lib/zod-schemas"
import { createServicePlan } from "@/lib/data/service-plans"
import { orgHasCapability } from "@/lib/page-guards"

const CAP = "core.servicePlans"

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(servicePlanCreateSchema, request)
  if (!body.ok) return body.response
  if (body.data.billingMode === "FLAT_PERIOD" && !(await orgHasCapability(g.orgId, "billing.periodInvoicing")))
    return forbidden("Flat-period billing requires the billing.periodInvoicing capability")
  return runWrite(() => createServicePlan(g.orgId, body.data), { created: true })
}
