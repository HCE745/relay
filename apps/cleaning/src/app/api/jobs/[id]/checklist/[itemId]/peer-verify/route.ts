import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { taskVerifySchema } from "@/lib/zod-schemas"
import { verifyChecklistTask, type TaskActor } from "@/lib/data/task-ownership"
import type { ActorRole } from "@/lib/tasks/verification"

const CAP = "operations.workVerification"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

// Peer verification: a coworker verifies another employee's work when the org
// has peer verification enabled. The data layer enforces peer-enabled AND that
// the verifier is not a worker on the task (no self-approval).
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id, itemId } = await params
  const body = await parseBody(taskVerifySchema, request)
  if (!body.ok) return body.response
  const actor: TaskActor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => verifyChecklistTask(g.orgId, id, itemId, actor, body.data))
}
