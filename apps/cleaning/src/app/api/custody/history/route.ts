import { requireOperations } from "@/lib/guards"
import { ok, badRequest } from "@/lib/api"
import { listAccessItemCustody, listAssetCustody } from "@/lib/data/custody"

const CAP = "operations.accessControl"

// Full custody history for one item (who holds it now, who had it before, when,
// and for what job). OWNER/ADMIN/MANAGER/SUPERVISOR only.
export async function GET(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const url = new URL(request.url)
  const accessItemId = url.searchParams.get("accessItemId")
  const assetId = url.searchParams.get("assetId")
  if (accessItemId) return ok(await listAccessItemCustody(g.orgId, accessItemId))
  if (assetId) return ok(await listAssetCustody(g.orgId, assetId))
  return badRequest("Specify accessItemId or assetId")
}
