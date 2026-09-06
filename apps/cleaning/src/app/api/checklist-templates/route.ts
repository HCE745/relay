import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { checklistTemplateCreateSchema } from "@/lib/zod-schemas"
import { createChecklistTemplate, listChecklistTemplates } from "@/lib/data/checklist-templates"

const CAP = "core.checklists"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listChecklistTemplates(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(checklistTemplateCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createChecklistTemplate(g.orgId, body.data), { created: true })
}
