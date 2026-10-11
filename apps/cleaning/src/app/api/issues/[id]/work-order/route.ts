import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { issueToWorkOrderSchema } from "@/lib/zod-schemas"
import { convertIssueToWorkOrder } from "@/lib/data/work-orders"
const CAP = "operations.workOrders"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(issueToWorkOrderSchema, request); if (!body.ok) return body.response
  return runWrite(() => convertIssueToWorkOrder(g.orgId, id, body.data, g.session.userId), { created: true })
}
