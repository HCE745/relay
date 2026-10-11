import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { changeOrderCreateSchema } from "@/lib/zod-schemas"
import { z } from "zod"
import { listChangeOrders, createChangeOrder } from "@/lib/data/change-orders"
const CAP = "operations.workOrders"
export async function GET(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const q = parseQuery(z.object({ jobId: z.string().optional(), contractId: z.string().optional(), status: z.string().optional() }), request.url)
  if (!q.ok) return q.response
  return ok(await listChangeOrders(g.orgId, q.data))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(changeOrderCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createChangeOrder(g.orgId, body.data, g.session.userId), { created: true })
}
