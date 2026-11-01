import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { deactivateSkill } from "@/lib/data/skills"

const CAP = "workforce.coverage"
type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate and drop the skill from assignments and site requirements.
  return runWrite(() => deactivateSkill(g.orgId, id))
}
