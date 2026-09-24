import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { assetMaintenanceSchema } from "@/lib/zod-schemas"
import { addMaintenance } from "@/lib/data/assets"

const CAP = "assets.management"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(assetMaintenanceSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => addMaintenance(g.orgId, id, g.session.userId, body.data), { created: true })
}
