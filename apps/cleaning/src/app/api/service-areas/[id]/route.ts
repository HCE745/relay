import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { serviceAreaUpdateSchema } from "@/lib/zod-schemas"
import { updateServiceArea, deleteServiceArea } from "@/lib/data/service-areas"
const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(serviceAreaUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateServiceArea(g.orgId, id, body.data))
}
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await deleteServiceArea(g.orgId, id)) ? { deleted: true } : null))
}
