import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { serviceLocationUpdateSchema } from "@/lib/zod-schemas"
import { updateServiceLocation, archiveServiceLocation } from "@/lib/data/service-locations"

const CAP = "core.locations"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(serviceLocationUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateServiceLocation(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveServiceLocation(g.orgId, id)) ? { archived: true } : null))
}
