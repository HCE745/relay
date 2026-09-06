import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { checklistTemplateUpdateSchema } from "@/lib/zod-schemas"
import { updateChecklistTemplate, archiveChecklistTemplate } from "@/lib/data/checklist-templates"

const CAP = "core.checklists"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(checklistTemplateUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateChecklistTemplate(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveChecklistTemplate(g.orgId, id)) ? { archived: true } : null))
}
