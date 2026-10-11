import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { workOrderCreateSchema } from "@/lib/zod-schemas"
import { listWorkOrders, createWorkOrder } from "@/lib/data/work-orders"
const CAP = "operations.workOrders"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listWorkOrders(g.orgId))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(workOrderCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createWorkOrder(g.orgId, body.data, g.session.userId), { created: true })
}
