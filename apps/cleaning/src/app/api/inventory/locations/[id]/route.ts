import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { inventoryLocationUpdateSchema } from "@/lib/zod-schemas"
import { updateInventoryLocation } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const b = await parseBody(inventoryLocationUpdateSchema, request); if (!b.ok) return b.response
  return runWrite(async () => ((await updateInventoryLocation(g.orgId, id, b.data)) ? { updated: true } : null))
}
