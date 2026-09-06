import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { removeAssignment } from "@/lib/data/assignments"

const CAP = "workforce.assignments"
type Ctx = { params: Promise<{ id: string; userId: string }> }

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id, userId } = await params
  return runWrite(async () => ((await removeAssignment(g.orgId, id, userId)) ? { removed: true } : null))
}
