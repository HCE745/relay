import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { workOrderUpdateSchema } from "@/lib/zod-schemas"
import { updateWorkOrder } from "@/lib/data/work-orders"
const CAP = "operations.workOrders"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(workOrderUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateWorkOrder(g.orgId, id, body.data, g.session.userId))
}
