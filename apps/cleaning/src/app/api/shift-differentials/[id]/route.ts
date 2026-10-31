import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { shiftDifferentialUpdateSchema } from "@/lib/zod-schemas"
import { updateDifferentialRule } from "@/lib/data/shift-differentials"

const CAP = "workforce.laborCosting"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(shiftDifferentialUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateDifferentialRule(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate — historical entries keep their snapshotted premium.
  return runWrite(() => updateDifferentialRule(g.orgId, id, { isActive: false }))
}
