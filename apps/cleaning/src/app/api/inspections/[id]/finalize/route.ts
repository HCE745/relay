import { requireInspector } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { finalizeInspectionSchema } from "@/lib/zod-schemas"
import { finalizeInspection } from "@/lib/scheduling/inspections"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(finalizeInspectionSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => finalizeInspection(g.orgId, id, g.userId, body.data.comments))
}
