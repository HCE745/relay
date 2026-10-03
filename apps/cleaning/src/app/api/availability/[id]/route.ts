import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { deleteUnavailability } from "@/lib/data/availability"

const CAP = "workforce.coverage"
type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await deleteUnavailability(g.orgId, id)) ? { deleted: true } : null))
}
