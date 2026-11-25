import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { supervisorAssignSchema } from "@/lib/zod-schemas"
import { assignSiteSupervisor } from "@/lib/data/supervisor"
const CAP = "core.locations"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const b = await parseBody(supervisorAssignSchema, request); if (!b.ok) return b.response
  return runWrite(async () => ((await assignSiteSupervisor(g.orgId, id, b.data.supervisorId ?? null)) ? { updated: true } : null))
}
