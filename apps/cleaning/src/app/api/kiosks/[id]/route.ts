import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { kioskUpdateSchema } from "@/lib/zod-schemas"
import { updateKiosk } from "@/lib/data/kiosks"

const CAP = "workforce.timeTracking"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(kioskUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateKiosk(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate — the device token stops working immediately.
  return runWrite(() => updateKiosk(g.orgId, id, { isActive: false }))
}
