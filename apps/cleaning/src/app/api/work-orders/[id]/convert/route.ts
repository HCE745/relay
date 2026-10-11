import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { workOrderConvertSchema } from "@/lib/zod-schemas"
import { convertWorkOrderToJob } from "@/lib/data/work-orders"
const CAP = "operations.workOrders"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(workOrderConvertSchema, request); if (!body.ok) return body.response
  return runWrite(() => convertWorkOrderToJob(g.orgId, id, body.data), { created: true })
}
