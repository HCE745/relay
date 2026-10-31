import { requireInspector } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { verifyCorrectiveWorkOrder } from "@/lib/data/work-orders"

const CAP = "operations.workOrders"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => verifyCorrectiveWorkOrder(g.orgId, id, g.userId))
}
