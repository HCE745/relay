import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { taskAssignSchema } from "@/lib/zod-schemas"
import { assignChecklistTask, type TaskActor } from "@/lib/data/task-ownership"
import type { ActorRole } from "@/lib/tasks/verification"

const CAP = "operations.taskOwnership"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

// Manager/supervisor assigns (or reassigns) a checklist task to employees.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id, itemId } = await params
  const body = await parseBody(taskAssignSchema, request)
  if (!body.ok) return body.response
  const actor: TaskActor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => assignChecklistTask(g.orgId, id, itemId, actor, body.data.assigneeIds))
}
