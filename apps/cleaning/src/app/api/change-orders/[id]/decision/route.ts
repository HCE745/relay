import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { changeOrderDecisionSchema } from "@/lib/zod-schemas"
import { recordChangeOrderDecision } from "@/lib/data/change-orders"
const CAP = "operations.workOrders"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(changeOrderDecisionSchema, request); if (!body.ok) return body.response
  return runWrite(() => recordChangeOrderDecision(g.orgId, id, body.data.decision, g.session.userId))
}
