import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { assetCreateSchema } from "@/lib/zod-schemas"
import { createAsset, listAssets } from "@/lib/data/assets"

const CAP = "assets.management"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listAssets(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(assetCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createAsset(g.orgId, body.data), { created: true })
}
