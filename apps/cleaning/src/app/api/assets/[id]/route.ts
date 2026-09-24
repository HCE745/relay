import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { assetUpdateSchema } from "@/lib/zod-schemas"
import { updateAsset } from "@/lib/data/assets"

const CAP = "assets.management"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(assetUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateAsset(g.orgId, id, body.data))
}
