import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { onboardingTaskCompleteSchema } from "@/lib/zod-schemas"
import { completeTask, reopenTask } from "@/lib/data/onboarding"

const CAP = "workforce.hiring"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(onboardingTaskCompleteSchema, request); if (!body.ok) return body.response
  return runWrite(() => completeTask(g.orgId, id, g.session.userId, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Reopen a task (un-complete it and its assignment).
  return runWrite(() => reopenTask(g.orgId, id))
}
