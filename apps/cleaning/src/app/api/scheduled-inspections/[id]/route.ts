import { requireInspector } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { setScheduledInspectionActive, deleteScheduledInspection } from "@/lib/scheduling/scheduled-inspections"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { active?: boolean } | null
  return runWrite(() => setScheduledInspectionActive(g.orgId, g.userId, id, Boolean(body?.active)))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => deleteScheduledInspection(g.orgId, g.userId, id))
}
