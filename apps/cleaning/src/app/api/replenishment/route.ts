import { requireStaff } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { replenishmentCreateSchema } from "@/lib/zod-schemas"
import { createReplenishmentRequest } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
export async function POST(request: Request) {
  const g = await requireStaff(CAP); if (!g.ok) return g.response
  const b = await parseBody(replenishmentCreateSchema, request); if (!b.ok) return b.response
  return runWrite(() => createReplenishmentRequest(g.orgId, g.userId, b.data))
}
