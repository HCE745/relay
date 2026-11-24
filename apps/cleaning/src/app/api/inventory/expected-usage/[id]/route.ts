import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { removeExpectedUsage } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }
export async function DELETE(_r: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await removeExpectedUsage(g.orgId, id)) ? { deleted: true } : null))
}
