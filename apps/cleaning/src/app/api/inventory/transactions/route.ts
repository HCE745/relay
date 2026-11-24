import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { stockTxnSchema } from "@/lib/zod-schemas"
import { applyStockTransaction } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const b = await parseBody(stockTxnSchema, request); if (!b.ok) return b.response
  return runWrite(() => applyStockTransaction(g.orgId, { ...b.data, actorUserId: g.session.userId }))
}
