import { requireOperations } from "@/lib/guards"
import { ok } from "@/lib/api"
import { listTaskHistory } from "@/lib/data/task-ownership"

const CAP = "operations.taskOwnership"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

// The immutable assignment + verification history for a task — used to establish
// responsibility after a complaint. Managers/supervisors only.
export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { itemId } = await params
  return ok(await listTaskHistory(g.orgId, itemId))
}
