import { requireInspector } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { createInspectionSchema } from "@/lib/zod-schemas"
import { createInspectionFromJob } from "@/lib/scheduling/inspections"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string }> }

// Start an inspection (DRAFT) from a Job — snapshots the chosen template's items.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(createInspectionSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createInspectionFromJob(g.orgId, id, g.userId, body.data.templateId), { created: true })
}
