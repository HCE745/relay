import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, forbidden } from "@/lib/api"
import { servicePlanUpdateSchema } from "@/lib/zod-schemas"
import { updateServicePlan, archiveServicePlan } from "@/lib/data/service-plans"
import { orgHasCapability } from "@/lib/page-guards"

const CAP = "core.servicePlans"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(servicePlanUpdateSchema, request)
  if (!body.ok) return body.response
  if (body.data.billingMode === "FLAT_PERIOD" && !(await orgHasCapability(g.orgId, "billing.periodInvoicing")))
    return forbidden("Flat-period billing requires the billing.periodInvoicing capability")
  return runWrite(() => updateServicePlan(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveServicePlan(g.orgId, id)) ? { archived: true } : null))
}
