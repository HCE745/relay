import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { inventoryLocationCreateSchema } from "@/lib/zod-schemas"
import { createInventoryLocation } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const b = await parseBody(inventoryLocationCreateSchema, request); if (!b.ok) return b.response
  return runWrite(() => createInventoryLocation(g.orgId, b.data))
}
