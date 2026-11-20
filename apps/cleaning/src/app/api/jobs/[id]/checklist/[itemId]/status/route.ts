import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { taskStatusActionSchema } from "@/lib/zod-schemas"
import {
  startChecklistTask,
  submitChecklistTask,
  markChecklistTaskCorrected,
  type TaskActor,
} from "@/lib/data/task-ownership"
import type { ActorRole } from "@/lib/tasks/verification"

const CAP = "operations.taskOwnership"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

// Worker-side task transitions on the field app: start / submit / mark corrected.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id, itemId } = await params
  const body = await parseBody(taskStatusActionSchema, request)
  if (!body.ok) return body.response
  const actor: TaskActor = { userId: g.userId, role: g.session.role as ActorRole }
  const { action, note } = body.data
  return runWrite(() => {
    if (action === "start") return startChecklistTask(g.orgId, id, itemId, actor)
    if (action === "submit") return submitChecklistTask(g.orgId, id, itemId, actor, { note })
    return markChecklistTaskCorrected(g.orgId, id, itemId, actor)
  })
}
