import { requireCleaner } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { selfAssignChecklistTask, type TaskActor } from "@/lib/data/task-ownership"
import type { ActorRole } from "@/lib/tasks/verification"

const CAP = "operations.taskOwnership"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

// A cleaner claims an unowned task on a job they are assigned to (divide work).
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id, itemId } = await params
  const actor: TaskActor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => selfAssignChecklistTask(g.orgId, id, itemId, actor))
}
