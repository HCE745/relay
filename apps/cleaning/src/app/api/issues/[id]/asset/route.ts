import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { issueAssetSchema } from "@/lib/zod-schemas"
import { setIssueAsset } from "@/lib/data/issues"

const CAP = "operations.issues"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(issueAssetSchema, request); if (!body.ok) return body.response
  return runWrite(() => setIssueAsset(g.orgId, id, g.userId, body.data.assetId ?? null))
}
