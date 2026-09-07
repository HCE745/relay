import { requireInspector } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { inspectionItemResultSchema } from "@/lib/zod-schemas"
import { setInspectionItemResult } from "@/lib/scheduling/inspections"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string; resultId: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id, resultId } = await params
  const body = await parseBody(inspectionItemResultSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setInspectionItemResult(g.orgId, id, resultId, body.data))
}
