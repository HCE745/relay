import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { inspectionTemplateUpdateSchema } from "@/lib/zod-schemas"
import { updateInspectionTemplate, archiveInspectionTemplate } from "@/lib/data/inspection-templates"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(inspectionTemplateUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateInspectionTemplate(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveInspectionTemplate(g.orgId, id)) ? { archived: true } : null))
}
